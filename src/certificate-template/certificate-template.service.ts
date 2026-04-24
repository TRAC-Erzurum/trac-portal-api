import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CertificateTemplate } from './entities/certificate-template.entity';
import type { CertificateTemplateElement } from './entities/certificate-template.entity';
import { CreateCertificateTemplateDto } from './dto/create-certificate-template.dto';
import { UpdateCertificateTemplateDto } from './dto/update-certificate-template.dto';
import { BranchService } from '../branch/services/branch.service';
import { Net } from '../net/entities/net.entity';
import { FileStorageService } from '../shared/storage';

@Injectable()
export class CertificateTemplateService {
  private static readonly DEFAULT_ELEMENT_BOX_WIDTH = 40;

  private static readonly DEFAULT_ELEMENT_BOX_HEIGHT = 8;

  private static readonly DEFAULT_ELEMENT_TEXT_ALIGN: 'left' | 'center' | 'right' =
    'left';

  constructor(
    @InjectRepository(CertificateTemplate)
    private readonly templateRepository: Repository<CertificateTemplate>,
    @InjectRepository(Net)
    private readonly netRepository: Repository<Net>,
    private readonly branchService: BranchService,
    private readonly fileStorage: FileStorageService,
  ) {}

  async findByBranchId(branchId: string): Promise<CertificateTemplate[]> {
    await this.branchService.findOne(branchId);
    return this.templateRepository.find({
      where: { branchId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, branchId?: string): Promise<CertificateTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id },
      relations: ['branch'],
    });
    if (!template) {
      throw new NotFoundException('error.notFound');
    }
    if (branchId && template.branchId !== branchId) {
      throw new ForbiddenException('error.forbiddenDescription');
    }
    return template;
  }

  private sanitizeElements(
    elements: CreateCertificateTemplateDto['elements'],
  ): CertificateTemplateElement[] {
    return (elements ?? []).map((el) => ({
      type: el.type,
      content: el.content,
      placeholderKey: el.placeholderKey,
      x: el.x,
      y: el.y,
      boxWidth:
        el.boxWidth ?? CertificateTemplateService.DEFAULT_ELEMENT_BOX_WIDTH,
      boxHeight:
        el.boxHeight ?? CertificateTemplateService.DEFAULT_ELEMENT_BOX_HEIGHT,
      textAlign:
        el.textAlign ??
        CertificateTemplateService.DEFAULT_ELEMENT_TEXT_ALIGN,
      fontSize: el.fontSize,
      color: el.color,
    }));
  }

  async create(
    branchId: string,
    dto: CreateCertificateTemplateDto,
    createdBy: string,
  ): Promise<CertificateTemplate> {
    await this.branchService.findOne(branchId);
    const template = this.templateRepository.create({
      name: dto.name,
      imagePath: dto.imagePath,
      branchId,
      elements: this.sanitizeElements(dto.elements),
      createdBy,
      updatedBy: [],
    });
    return this.templateRepository.save(template);
  }

  async update(
    id: string,
    branchId: string,
    dto: UpdateCertificateTemplateDto,
    updatedBy: string,
  ): Promise<CertificateTemplate> {
    const template = await this.findOne(id, branchId);
    if (dto.name !== undefined) template.name = dto.name;
    if (dto.imagePath !== undefined) {
      if (template.imagePath && template.imagePath !== dto.imagePath) {
        const oldLogicalPath = template.imagePath.replace(/^\//, '');
        await this.fileStorage.delete(oldLogicalPath);
      }
      template.imagePath = dto.imagePath;
    }
    if (dto.elements !== undefined)
      template.elements = this.sanitizeElements(dto.elements);
    template.updatedBy = [...(template.updatedBy || []), updatedBy];
    return this.templateRepository.save(template);
  }

  async getNetsUsingTemplate(templateId: string): Promise<{ id: string; name: string }[]> {
    const nets = await this.netRepository.find({
      where: { certificateTemplateId: templateId },
      select: ['id', 'name'],
    });
    return nets;
  }

  async remove(
    id: string,
    branchId: string,
    force?: boolean,
  ): Promise<{ deleted: boolean; netsUpdated?: number }> {
    const template = await this.findOne(id, branchId);
    const netsUsing = await this.getNetsUsingTemplate(id);
    if (netsUsing.length > 0 && !force) {
      throw new ConflictException({
        message: 'error.templateInUse',
        netsUsing: netsUsing.map((n) => ({ id: n.id, name: n.name })),
      });
    }
    if (netsUsing.length > 0) {
      await this.netRepository.update(
        { certificateTemplateId: id },
        { certificateTemplateId: null },
      );
    }
    if (template.imagePath) {
      const logicalPath = template.imagePath.replace(/^\//, '');
      await this.fileStorage.delete(logicalPath);
    }
    await this.templateRepository.remove(template);
    return { deleted: true, netsUpdated: netsUsing.length };
  }
}
