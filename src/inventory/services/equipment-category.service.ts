import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { EquipmentCategory } from '../entities/equipment-category.entity';
import { FileStorageService } from '../../shared/storage';
import { CategoryPropertyDefinition } from '../entities/category-property-definition.entity';
import { Equipment } from '../entities/equipment.entity';
import {
  CreateEquipmentCategoryDto,
  UpdateEquipmentCategoryDto,
  CreateCategoryPropertyDto,
  CreateUpdateCategoryPropertyDto,
  UpdateCategoryPropertyDto,
} from '../dto';

@Injectable()
export class EquipmentCategoryService {
  constructor(
    @InjectRepository(EquipmentCategory)
    private readonly categoryRepository: Repository<EquipmentCategory>,
    @InjectRepository(CategoryPropertyDefinition)
    private readonly propertyDefinitionRepository: Repository<CategoryPropertyDefinition>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    private readonly dataSource: DataSource,
    private readonly fileStorage: FileStorageService,
  ) {}

  async findAll(): Promise<EquipmentCategory[]> {
    return this.categoryRepository.find({
      where: { parentId: IsNull() },
      relations: [
        'children',
        'children.children',
        'children.children.children',
        'propertyDefinitions',
        'children.propertyDefinitions',
        'children.children.propertyDefinitions',
        'children.children.children.propertyDefinitions',
      ],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findAllFlat(): Promise<EquipmentCategory[]> {
    return this.categoryRepository.find({
      relations: ['parent', 'propertyDefinitions'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<EquipmentCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['propertyDefinitions'],
    });
    if (!category) {
      throw new NotFoundException('error.categoryNotFound');
    }

    let current = category;
    while (current.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: current.parentId },
      });
      if (!parent) break;
      current.parent = parent;
      current = parent;
    }

    return category;
  }

  async getEffectiveProperties(
    categoryId: string,
  ): Promise<CategoryPropertyDefinition[]> {
    const chain: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      chain.push(currentId);
      const cat = await this.categoryRepository.findOne({
        where: { id: currentId },
        select: ['id', 'parentId'],
      });
      if (!cat) break;
      currentId = cat.parentId;
    }

    chain.reverse();

    if (chain.length === 0) return [];

    const properties = await this.propertyDefinitionRepository
      .createQueryBuilder('pd')
      .where('pd.categoryId IN (:...categoryIds)', { categoryIds: chain })
      .getMany();

    const depthMap = new Map(chain.map((id, index) => [id, index]));
    properties.sort((a, b) => {
      const depthA = depthMap.get(a.categoryId) ?? 0;
      const depthB = depthMap.get(b.categoryId) ?? 0;
      if (depthA !== depthB) return depthA - depthB;
      return a.sortOrder - b.sortOrder;
    });

    return properties;
  }

  async create(
    dto: CreateEquipmentCategoryDto,
    email: string,
  ): Promise<EquipmentCategory> {
    if (dto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('error.parentCategoryNotFound');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const category = queryRunner.manager.create(EquipmentCategory, {
        name: dto.name,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        createdBy: email,
        updatedBy: [],
      });
      const saved = await queryRunner.manager.save(EquipmentCategory, category);

      const definitions = dto.propertyDefinitions ?? [];
      for (let i = 0; i < definitions.length; i++) {
        const pd = definitions[i];
        const prop = queryRunner.manager.create(CategoryPropertyDefinition, {
          categoryId: saved.id,
          name: pd.name,
          type: pd.type,
          isRequired: pd.isRequired ?? false,
          sortOrder: pd.sortOrder ?? i,
          enumValues: pd.enumValues ?? null,
          numberArrayMaxLength: pd.numberArrayMaxLength ?? null,
          minValue: pd.minValue ?? null,
          maxValue: pd.maxValue ?? null,
          createdBy: email,
          updatedBy: [],
        });
        await queryRunner.manager.save(CategoryPropertyDefinition, prop);
      }

      await queryRunner.commitTransaction();
      return this.findOne(saved.id);
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      if (err.code === '23505') {
        throw new ConflictException('error.categoryNameExists');
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async getDescendantIds(categoryId: string): Promise<string[]> {
    const children = await this.categoryRepository.find({
      where: { parentId: categoryId },
      select: ['id'],
    });
    const ids: string[] = [];
    for (const c of children) {
      ids.push(c.id);
      ids.push(...(await this.getDescendantIds(c.id)));
    }
    return ids;
  }

  /** Returns the given category id and all its descendant ids (for filtering equipment by category tree). */
  async getCategoryAndDescendantIds(categoryId: string): Promise<string[]> {
    const descendantIds = await this.getDescendantIds(categoryId);
    return [categoryId, ...descendantIds];
  }

  async update(
    id: string,
    dto: UpdateEquipmentCategoryDto,
    email: string,
  ): Promise<EquipmentCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('error.categoryNotFound');
    }

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;

    if (dto.photoPath === null) {
      if (category.photoPath) {
        await this.fileStorage.delete(category.photoPath);
      }
      category.photoPath = null;
    }

    if (dto.parentId !== undefined) {
      const newParentId =
        dto.parentId === '' || dto.parentId === null ? null : dto.parentId;
      if (newParentId === id) {
        throw new BadRequestException('error.categoryParentSelf');
      }
      if (newParentId) {
        const descendantIds = await this.getDescendantIds(id);
        if (descendantIds.includes(newParentId)) {
          throw new BadRequestException('error.categoryParentDescendant');
        }
        const parent = await this.categoryRepository.findOne({
          where: { id: newParentId },
        });
        if (!parent) {
          throw new NotFoundException('error.parentCategoryNotFound');
        }
      }
      category.parentId = newParentId;
    }

    category.updatedBy = [...(category.updatedBy || []), email];

    try {
      await this.categoryRepository.save(category);
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('error.categoryNameExists');
      }
      throw err;
    }

    if (dto.propertyDefinitions !== undefined) {
      const payloadIds = new Set(
        dto.propertyDefinitions
          .map((p) => p.id)
          .filter((x): x is string => !!x),
      );
      const namesLower = dto.propertyDefinitions.map((p) =>
        p.name.toLowerCase(),
      );
      const duplicateName = namesLower.some(
        (n, i) => namesLower.indexOf(n) !== i,
      );
      if (duplicateName) {
        throw new ConflictException('error.propertyNameExists');
      }

      const existing = await this.propertyDefinitionRepository.find({
        where: { categoryId: id },
      });

      const toRemove = existing.filter((p) => !payloadIds.has(p.id));
      if (toRemove.length > 0) {
        await this.propertyDefinitionRepository.remove(toRemove);
      }

      for (const item of dto.propertyDefinitions) {
        if (item.id) {
          const prop = existing.find((p) => p.id === item.id);
          if (prop) {
            await this.propertyDefinitionRepository.update(prop.id, {
              name: item.name,
              type: item.type,
              isRequired: item.isRequired ?? false,
              sortOrder: item.sortOrder ?? 0,
              enumValues: item.enumValues ?? null,
              numberArrayMaxLength: item.numberArrayMaxLength ?? null,
              minValue: item.minValue ?? null,
              maxValue: item.maxValue ?? null,
              updatedBy: [...(prop.updatedBy || []), email],
            });
          }
        } else {
          await this.propertyDefinitionRepository.insert({
            categoryId: id,
            name: item.name,
            type: item.type,
            isRequired: item.isRequired ?? false,
            sortOrder: item.sortOrder ?? 0,
            enumValues: item.enumValues ?? null,
            numberArrayMaxLength: item.numberArrayMaxLength ?? null,
            minValue: item.minValue ?? null,
            maxValue: item.maxValue ?? null,
            createdBy: email,
            updatedBy: [],
          });
        }
      }
    }

    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('error.categoryNotFound');
    }

    const childCount = await this.categoryRepository.count({
      where: { parentId: id },
    });
    if (childCount > 0) {
      throw new BadRequestException('error.categoryHasChildren');
    }

    const equipmentCount = await this.equipmentRepository.count({
      where: { categoryId: id },
    });
    if (equipmentCount > 0) {
      throw new BadRequestException('error.categoryHasEquipment');
    }

    if (category.photoPath) {
      await this.fileStorage.delete(category.photoPath);
    }

    await this.categoryRepository.remove(category);
  }

  async uploadPhoto(id: string, filePath: string): Promise<EquipmentCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('error.categoryNotFound');
    }

    if (category.photoPath) {
      await this.fileStorage.delete(category.photoPath);
    }

    category.photoPath = filePath;
    return this.categoryRepository.save(category);
  }

  async addProperty(
    categoryId: string,
    dto: CreateCategoryPropertyDto,
    email: string,
  ): Promise<CategoryPropertyDefinition> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('error.categoryNotFound');
    }

    const effectiveProps = await this.getEffectiveProperties(categoryId);
    const nameConflict = effectiveProps.some(
      (p) => p.name.toLowerCase() === dto.name.toLowerCase(),
    );
    if (nameConflict) {
      throw new ConflictException('error.propertyNameExists');
    }

    const property = this.propertyDefinitionRepository.create({
      categoryId,
      name: dto.name,
      type: dto.type,
      isRequired: dto.isRequired ?? false,
      sortOrder: dto.sortOrder ?? 0,
      enumValues: dto.enumValues ?? null,
      numberArrayMaxLength: dto.numberArrayMaxLength ?? null,
      minValue: dto.minValue ?? null,
      maxValue: dto.maxValue ?? null,
      createdBy: email,
      updatedBy: [],
    });

    return this.propertyDefinitionRepository.save(property);
  }

  async updateProperty(
    categoryId: string,
    propertyId: string,
    dto: UpdateCategoryPropertyDto,
    email: string,
  ): Promise<CategoryPropertyDefinition> {
    const property = await this.propertyDefinitionRepository.findOne({
      where: { id: propertyId, categoryId },
    });
    if (!property) {
      throw new NotFoundException('error.propertyNotFound');
    }

    if (
      dto.name !== undefined &&
      dto.name.toLowerCase() !== property.name.toLowerCase()
    ) {
      const effectiveProps = await this.getEffectiveProperties(categoryId);
      const nameConflict = effectiveProps.some(
        (p) =>
          p.id !== propertyId &&
          p.name.toLowerCase() === dto.name.toLowerCase(),
      );
      if (nameConflict) {
        throw new ConflictException('error.propertyNameExists');
      }
      property.name = dto.name;
    }

    if (dto.type !== undefined) property.type = dto.type;
    if (dto.isRequired !== undefined) property.isRequired = dto.isRequired;
    if (dto.sortOrder !== undefined) property.sortOrder = dto.sortOrder;
    if (dto.enumValues !== undefined) property.enumValues = dto.enumValues;
    if (dto.numberArrayMaxLength !== undefined)
      property.numberArrayMaxLength = dto.numberArrayMaxLength;
    if (dto.minValue !== undefined) property.minValue = dto.minValue;
    if (dto.maxValue !== undefined) property.maxValue = dto.maxValue;

    property.updatedBy = [...(property.updatedBy || []), email];

    return this.propertyDefinitionRepository.save(property);
  }

  async deleteProperty(categoryId: string, propertyId: string): Promise<void> {
    const property = await this.propertyDefinitionRepository.findOne({
      where: { id: propertyId, categoryId },
    });
    if (!property) {
      throw new NotFoundException('error.propertyNotFound');
    }

    await this.propertyDefinitionRepository.remove(property);
  }
}
