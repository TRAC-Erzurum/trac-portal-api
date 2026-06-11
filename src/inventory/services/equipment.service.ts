import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Equipment } from '../entities/equipment.entity';
import { FileStorageService } from '../../shared/storage';
import { EquipmentCategory } from '../entities/equipment-category.entity';
import { EquipmentPhoto } from '../entities/equipment-photo.entity';
import { EquipmentPropertyValue } from '../entities/equipment-property-value.entity';
import { EquipmentRelation } from '../entities/equipment-relation.entity';
import { CategoryPropertyDefinition } from '../entities/category-property-definition.entity';
import { OwnerType } from '../enums/owner-type.enum';
import { PropertyType } from '../enums/property-type.enum';
import {
  CreateEquipmentDto,
  UpdateEquipmentDto,
  EquipmentQueryDto,
  PropertyValueDto,
  CreateEquipmentRelationDto,
} from '../dto';
import { EquipmentCategoryService } from './equipment-category.service';
import { EquipmentStatusService } from './equipment-status.service';
import { OperatorBranchMembership } from '../../branch/entities/operator-branch-membership.entity';
import { MembershipStatus } from '../../branch/enums/membership-status.enum';
import { normalizeTurkishSearchTerm } from '../../shared/utils/turkish-search.util';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(EquipmentPhoto)
    private readonly photoRepository: Repository<EquipmentPhoto>,
    @InjectRepository(EquipmentPropertyValue)
    private readonly propertyValueRepository: Repository<EquipmentPropertyValue>,
    @InjectRepository(EquipmentRelation)
    private readonly relationRepository: Repository<EquipmentRelation>,
    private readonly categoryService: EquipmentCategoryService,
    private readonly statusService: EquipmentStatusService,
    private readonly dataSource: DataSource,
    private readonly fileStorage: FileStorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // Single item
  // ---------------------------------------------------------------------------

  async findOne(id: string): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id },
      relations: [
        'category',
        'category.parent',
        'status',
        'photos',
        'propertyValues',
        'propertyValues.propertyDefinition',
        'relationsAsSource',
        'relationsAsSource.targetEquipment',
        'relationsAsSource.targetEquipment.category',
        'relationsAsSource.targetEquipment.status',
        'relationsAsTarget',
        'relationsAsTarget.sourceEquipment',
        'relationsAsTarget.sourceEquipment.category',
        'relationsAsTarget.sourceEquipment.status',
      ],
    });
    if (!equipment) {
      throw new NotFoundException('error.equipmentNotFound');
    }

    // Walk up the category parent chain for full path display
    let cat = equipment.category?.parent;
    while (cat?.parentId && !cat.parent) {
      const parent = await this.dataSource
        .getRepository(EquipmentCategory)
        .findOne({ where: { id: cat.parentId } });
      if (!parent) break;
      cat.parent = parent;
      cat = parent;
    }

    equipment.photos?.sort((a, b) => a.sortOrder - b.sortOrder);
    return equipment;
  }

  // ---------------------------------------------------------------------------
  // List queries
  // ---------------------------------------------------------------------------

  async findByOperator(
    operatorId: string,
    query: EquipmentQueryDto,
    requestingOperatorId?: string,
  ): Promise<{ data: Equipment[]; total: number }> {
    const qb = this.createListQuery()
      .where('equipment.ownerType = :ownerType', {
        ownerType: OwnerType.OPERATOR,
      })
      .andWhere('equipment.operatorId = :operatorId', { operatorId });

    if (requestingOperatorId !== operatorId) {
      qb.andWhere('equipment.isVisible = :isVisible', { isVisible: true });
    }

    await this.applyFilters(qb, query);
    return this.paginate(qb, query);
  }

  async findByBranch(
    branchId: string,
    query: EquipmentQueryDto,
  ): Promise<{ data: Equipment[]; total: number }> {
    const qb = this.createListQuery()
      .where('equipment.ownerType = :ownerType', {
        ownerType: OwnerType.BRANCH,
      })
      .andWhere('equipment.branchId = :branchId', { branchId });

    await this.applyFilters(qb, query);
    return this.paginate(qb, query);
  }

  async findBranchMembersEquipment(
    branchId: string,
    query: EquipmentQueryDto,
  ): Promise<{ data: Equipment[]; total: number }> {
    const qb = this.createListQuery()
      .innerJoinAndSelect('equipment.operator', 'operator')
      .innerJoin(
        OperatorBranchMembership,
        'membership',
        'membership.operatorId = operator.id AND membership.branchId = :branchId AND membership.status = :membershipStatus',
        { branchId, membershipStatus: MembershipStatus.APPROVED },
      )
      .where('equipment.ownerType = :ownerType', {
        ownerType: OwnerType.OPERATOR,
      })
      .andWhere('equipment.isVisible = :isVisible', { isVisible: true });

    await this.applyFilters(qb, query);
    return this.paginate(qb, query);
  }

  // ---------------------------------------------------------------------------
  // Counts
  // ---------------------------------------------------------------------------

  async countByOperator(
    operatorId: string,
    visibleOnly: boolean,
  ): Promise<number> {
    const where: Record<string, any> = {
      ownerType: OwnerType.OPERATOR,
      operatorId,
    };
    if (visibleOnly) where.isVisible = true;
    return this.equipmentRepository.count({ where });
  }

  async countByBranch(branchId: string): Promise<number> {
    return this.equipmentRepository.count({
      where: { ownerType: OwnerType.BRANCH, branchId },
    });
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateEquipmentDto, email: string): Promise<Equipment> {
    await this.categoryService.findOne(dto.categoryId);
    await this.statusService.findOne(dto.statusId);

    if (dto.ownerType === OwnerType.OPERATOR && !dto.operatorId) {
      throw new BadRequestException('error.operatorIdRequired');
    }
    if (dto.ownerType === OwnerType.BRANCH && !dto.branchId) {
      throw new BadRequestException('error.branchIdRequired');
    }

    await this.validatePropertyValues(dto.categoryId, dto.propertyValues);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const equipment = queryRunner.manager.create(Equipment, {
        categoryId: dto.categoryId,
        statusId: dto.statusId,
        ownerType: dto.ownerType,
        operatorId: dto.operatorId ?? null,
        branchId: dto.branchId ?? null,
        label: dto.label,
        note: dto.note,
        isVisible: dto.isVisible ?? true,
        quantity: dto.quantity ?? 1,
        createdBy: email,
        updatedBy: [],
      });

      const saved = await queryRunner.manager.save(Equipment, equipment);

      if (dto.propertyValues?.length) {
        const pvEntities = dto.propertyValues.map((pv) =>
          queryRunner.manager.create(EquipmentPropertyValue, {
            equipmentId: saved.id,
            propertyDefinitionId: pv.propertyDefinitionId,
            value: pv.value,
          }),
        );
        await queryRunner.manager.save(EquipmentPropertyValue, pvEntities);
      }

      await queryRunner.commitTransaction();
      return this.findOne(saved.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(
    id: string,
    dto: UpdateEquipmentDto,
    email: string,
  ): Promise<Equipment> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id },
    });
    if (!equipment) {
      throw new NotFoundException('error.equipmentNotFound');
    }

    if (dto.statusId !== undefined) {
      await this.statusService.findOne(dto.statusId);
      equipment.statusId = dto.statusId;
    }
    if (dto.label !== undefined) equipment.label = dto.label;
    if (dto.note !== undefined) equipment.note = dto.note;
    if (dto.isVisible !== undefined) equipment.isVisible = dto.isVisible;
    if (dto.quantity !== undefined) equipment.quantity = dto.quantity;

    equipment.updatedBy = [...(equipment.updatedBy || []), email];

    if (dto.propertyValues !== undefined) {
      await this.validatePropertyValues(
        equipment.categoryId,
        dto.propertyValues,
      );

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager.save(Equipment, equipment);

        await queryRunner.manager.delete(EquipmentPropertyValue, {
          equipmentId: id,
        });

        if (dto.propertyValues.length) {
          const pvEntities = dto.propertyValues.map((pv) =>
            queryRunner.manager.create(EquipmentPropertyValue, {
              equipmentId: id,
              propertyDefinitionId: pv.propertyDefinitionId,
              value: pv.value,
            }),
          );
          await queryRunner.manager.save(EquipmentPropertyValue, pvEntities);
        }

        await queryRunner.commitTransaction();
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } else {
      await this.equipmentRepository.save(equipment);
    }

    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id },
      relations: ['photos'],
    });
    if (!equipment) {
      throw new NotFoundException('error.equipmentNotFound');
    }

    for (const photo of equipment.photos) {
      await this.fileStorage.delete(photo.filePath);
    }

    await this.equipmentRepository.remove(equipment);
  }

  // ---------------------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------------------

  async uploadPhotos(
    equipmentId: string,
    filePaths: string[],
  ): Promise<EquipmentPhoto[]> {
    const equipment = await this.equipmentRepository.findOne({
      where: { id: equipmentId },
      relations: ['photos'],
    });
    if (!equipment) {
      throw new NotFoundException('error.equipmentNotFound');
    }

    const existingCount = equipment.photos.length;
    if (existingCount + filePaths.length > 5) {
      throw new BadRequestException('error.tooManyPhotos');
    }

    const photos = filePaths.map((filePath, index) => {
      return this.photoRepository.create({
        equipmentId,
        filePath,
        sortOrder: existingCount + index,
      });
    });

    return this.photoRepository.save(photos);
  }

  async deletePhoto(equipmentId: string, photoId: string): Promise<void> {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId, equipmentId },
    });
    if (!photo) {
      throw new NotFoundException('error.photoNotFound');
    }

    await this.fileStorage.delete(photo.filePath);
    await this.photoRepository.remove(photo);
  }

  // ---------------------------------------------------------------------------
  // Relations
  // ---------------------------------------------------------------------------

  async addRelation(
    equipmentId: string,
    dto: CreateEquipmentRelationDto,
    email: string,
  ): Promise<EquipmentRelation> {
    const source = await this.equipmentRepository.findOne({
      where: { id: equipmentId },
    });
    if (!source) {
      throw new NotFoundException('error.equipmentNotFound');
    }

    const target = await this.equipmentRepository.findOne({
      where: { id: dto.targetEquipmentId },
    });
    if (!target) {
      throw new NotFoundException('error.targetEquipmentNotFound');
    }

    if (source.ownerType !== target.ownerType) {
      throw new BadRequestException('error.relationDifferentOwnerType');
    }
    if (
      source.ownerType === OwnerType.OPERATOR &&
      source.operatorId !== target.operatorId
    ) {
      throw new BadRequestException('error.relationDifferentOwner');
    }
    if (
      source.ownerType === OwnerType.BRANCH &&
      source.branchId !== target.branchId
    ) {
      throw new BadRequestException('error.relationDifferentOwner');
    }

    const existing = await this.relationRepository.findOne({
      where: [
        {
          sourceEquipmentId: equipmentId,
          targetEquipmentId: dto.targetEquipmentId,
        },
        {
          sourceEquipmentId: dto.targetEquipmentId,
          targetEquipmentId: equipmentId,
        },
      ],
    });
    if (existing) {
      throw new ConflictException('error.relationAlreadyExists');
    }

    const relation = this.relationRepository.create({
      sourceEquipmentId: equipmentId,
      targetEquipmentId: dto.targetEquipmentId,
      type: dto.type,
      createdBy: email,
    });

    return this.relationRepository.save(relation);
  }

  async removeRelation(equipmentId: string, relationId: string): Promise<void> {
    const relation = await this.relationRepository.findOne({
      where: { id: relationId },
    });
    if (!relation) {
      throw new NotFoundException('error.relationNotFound');
    }

    if (
      relation.sourceEquipmentId !== equipmentId &&
      relation.targetEquipmentId !== equipmentId
    ) {
      throw new BadRequestException('error.relationNotBelongToEquipment');
    }

    await this.relationRepository.remove(relation);
  }

  // ---------------------------------------------------------------------------
  // Property value validation
  // ---------------------------------------------------------------------------

  async validatePropertyValues(
    categoryId: string,
    values: PropertyValueDto[],
  ): Promise<void> {
    const effectiveProperties =
      await this.categoryService.getEffectiveProperties(categoryId);

    const valueMap = new Map(
      values.map((v) => [v.propertyDefinitionId, v.value]),
    );

    for (const prop of effectiveProperties) {
      if (prop.isRequired && !valueMap.has(prop.id)) {
        throw new BadRequestException('error.requiredPropertyMissing');
      }
    }

    const propMap = new Map(effectiveProperties.map((p) => [p.id, p]));

    for (const val of values) {
      const prop = propMap.get(val.propertyDefinitionId);
      if (!prop) {
        throw new BadRequestException('error.invalidPropertyDefinition');
      }

      switch (prop.type) {
        case PropertyType.ENUM:
          if (typeof val.value !== 'string') {
            throw new BadRequestException('error.invalidEnumValue');
          }
          if (prop.enumValues && !prop.enumValues.includes(val.value)) {
            prop.enumValues.push(val.value);
            await this.dataSource
              .getRepository(CategoryPropertyDefinition)
              .save(prop);
          }
          break;

        case PropertyType.MULTI_SELECT:
          if (!Array.isArray(val.value)) {
            throw new BadRequestException('error.invalidMultiSelectValue');
          }
          if (prop.isRequired && val.value.length === 0) {
            throw new BadRequestException('error.requiredPropertyEmpty');
          }
          if (val.value.some((v: any) => typeof v !== 'string')) {
            throw new BadRequestException('error.invalidMultiSelectValue');
          }
          if (prop.enumValues) {
            const invalid = val.value.filter(
              (v: string) => !prop.enumValues.includes(v),
            );
            if (invalid.length > 0) {
              throw new BadRequestException('error.invalidMultiSelectValue');
            }
          }
          break;

        case PropertyType.NUMBER: {
          const num =
            typeof val.value === 'string' ? Number(val.value) : val.value;
          if (typeof num !== 'number' || isNaN(num)) {
            throw new BadRequestException('error.invalidNumberValue');
          }
          if (prop.minValue !== null && num < Number(prop.minValue)) {
            throw new BadRequestException('error.numberBelowMin');
          }
          if (prop.maxValue !== null && num > Number(prop.maxValue)) {
            throw new BadRequestException('error.numberAboveMax');
          }
          break;
        }

        case PropertyType.NUMBER_ARRAY:
          if (!Array.isArray(val.value)) {
            throw new BadRequestException('error.invalidNumberArrayValue');
          }
          if (val.value.some((v: any) => typeof v !== 'number' || isNaN(v))) {
            throw new BadRequestException('error.invalidNumberArrayValue');
          }
          if (
            prop.numberArrayMaxLength !== null &&
            val.value.length > prop.numberArrayMaxLength
          ) {
            throw new BadRequestException('error.numberArrayTooLong');
          }
          break;

        case PropertyType.STRING:
          if (typeof val.value !== 'string') {
            throw new BadRequestException('error.invalidStringValue');
          }
          if (prop.isRequired && val.value.trim() === '') {
            throw new BadRequestException('error.requiredPropertyEmpty');
          }
          break;

        case PropertyType.BOOLEAN:
          if (typeof val.value !== 'boolean') {
            throw new BadRequestException('error.invalidBooleanValue');
          }
          break;

        case PropertyType.DATE:
          if (typeof val.value !== 'string' || isNaN(Date.parse(val.value))) {
            throw new BadRequestException('error.invalidDateValue');
          }
          break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createListQuery(): SelectQueryBuilder<Equipment> {
    return this.equipmentRepository
      .createQueryBuilder('equipment')
      .leftJoinAndSelect('equipment.category', 'category')
      .leftJoinAndSelect('category.parent', 'categoryParent')
      .leftJoinAndSelect('equipment.status', 'status')
      .leftJoinAndSelect('equipment.photos', 'photo')
      .leftJoinAndSelect('equipment.propertyValues', 'pv')
      .leftJoinAndSelect('pv.propertyDefinition', 'pd')
      .addOrderBy('equipment.createdAt', 'DESC');
  }

  private async applyFilters(
    qb: SelectQueryBuilder<Equipment>,
    query: EquipmentQueryDto,
  ): Promise<void> {
    if (query.search) {
      const search = normalizeTurkishSearchTerm(query.search);
      qb.andWhere(
        '(LOWER(equipment.label) LIKE :search OR LOWER(equipment.note) LIKE :search OR LOWER(category.name) LIKE :search)',
        { search },
      );
    }

    if (query.categoryId) {
      const categoryIds =
        await this.categoryService.getCategoryAndDescendantIds(
          query.categoryId,
        );
      qb.andWhere('equipment.categoryId IN (:...categoryIds)', {
        categoryIds,
      });
    }

    if (query.statusId) {
      qb.andWhere('equipment.statusId = :statusId', {
        statusId: query.statusId,
      });
    }
  }

  private async paginate(
    qb: SelectQueryBuilder<Equipment>,
    query: EquipmentQueryDto,
  ): Promise<{ data: Equipment[]; total: number }> {
    const pageNumber = query.pageNumber ?? 1;
    const pageSize = query.pageSize ?? 50;

    const total = await qb.getCount();
    qb.skip((pageNumber - 1) * pageSize).take(pageSize);

    const data = await qb.getMany();
    return { data, total };
  }
}
