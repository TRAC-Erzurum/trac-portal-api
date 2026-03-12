import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Roles } from '../../auth/decorators/roles.decorator';
import { FileStorageService } from '../../shared/storage';
import { MAX_UPLOAD_BYTES } from '../../shared/constants/upload.constants';
import { Role } from '../../auth/enums/role.enum';
import { EquipmentService } from '../services/equipment.service';
import {
  CreateEquipmentDto,
  UpdateEquipmentDto,
  EquipmentQueryDto,
  CreateEquipmentRelationDto,
} from '../dto';
import { OwnerType } from '../enums/owner-type.enum';

@Controller('equipment')
@Roles(Role.VOLUNTEER)
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly fileStorage: FileStorageService,
  ) {}

  @Get('operator/:operatorId')
  findByOperator(
    @Param('operatorId') operatorId: string,
    @Query() query: EquipmentQueryDto,
    @Req() req: any,
  ) {
    return this.equipmentService.findByOperator(
      operatorId,
      query,
      req.user.operatorId,
    );
  }

  @Get('branch/:branchId')
  findByBranch(
    @Param('branchId') branchId: string,
    @Query() query: EquipmentQueryDto,
  ) {
    return this.equipmentService.findByBranch(branchId, query);
  }

  @Get('branch/:branchId/members')
  findBranchMembersEquipment(
    @Param('branchId') branchId: string,
    @Query() query: EquipmentQueryDto,
  ) {
    return this.equipmentService.findBranchMembersEquipment(branchId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equipmentService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEquipmentDto, @Req() req: any) {
    return this.equipmentService.create(dto, req.user.email);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
    @Req() req: any,
  ) {
    await this.verifyOwnership(id, req);
    return this.equipmentService.update(id, dto, req.user.email);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    await this.verifyOwnership(id, req);
    return this.equipmentService.delete(id);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return cb(
            new BadRequestException('error.invalidFileType'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    if (!files?.length) {
      throw new BadRequestException('error.noFileUploaded');
    }
    await this.verifyOwnership(id, req);
    const filePaths: string[] = [];
    for (const f of files) {
      const filename = `${crypto.randomUUID()}${extname(f.originalname)}`;
      const logicalPath = `uploads/equipment/${filename}`;
      await this.fileStorage.putBytes(logicalPath, f.buffer, f.mimetype);
      filePaths.push(logicalPath);
    }
    return this.equipmentService.uploadPhotos(id, filePaths);
  }

  @Delete(':id/photos/:photoId')
  async deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @Req() req: any,
  ) {
    await this.verifyOwnership(id, req);
    return this.equipmentService.deletePhoto(id, photoId);
  }

  @Post(':id/relations')
  async addRelation(
    @Param('id') id: string,
    @Body() dto: CreateEquipmentRelationDto,
    @Req() req: any,
  ) {
    await this.verifyOwnership(id, req);
    return this.equipmentService.addRelation(id, dto, req.user.email);
  }

  @Delete(':id/relations/:relationId')
  async removeRelation(
    @Param('id') id: string,
    @Param('relationId') relationId: string,
    @Req() req: any,
  ) {
    await this.verifyOwnership(id, req);
    return this.equipmentService.removeRelation(id, relationId);
  }

  private async verifyOwnership(id: string, req: any): Promise<void> {
    if (req.user.role === Role.SUPER_ADMIN) return;

    const equipment = await this.equipmentService.findOne(id);

    if (
      equipment.ownerType === OwnerType.OPERATOR &&
      equipment.operatorId === req.user.operatorId
    ) {
      return;
    }

    if (
      equipment.ownerType === OwnerType.BRANCH &&
      equipment.branchId === req.user.currentBranchId &&
      (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN)
    ) {
      return;
    }

    throw new ForbiddenException('error.noPermission');
  }
}
