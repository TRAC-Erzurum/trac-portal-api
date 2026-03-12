import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Roles } from '../../auth/decorators/roles.decorator';
import { FileStorageService } from '../../shared/storage';
import { MAX_UPLOAD_BYTES } from '../../shared/constants/upload.constants';
import { Role } from '../../auth/enums/role.enum';
import { EquipmentCategoryService } from '../services/equipment-category.service';
import {
  CreateEquipmentCategoryDto,
  UpdateEquipmentCategoryDto,
  CreateCategoryPropertyDto,
  UpdateCategoryPropertyDto,
} from '../dto';

@Controller('equipment-categories')
@Roles(Role.VOLUNTEER)
export class EquipmentCategoryController {
  constructor(
    private readonly categoryService: EquipmentCategoryService,
    private readonly fileStorage: FileStorageService,
  ) {}

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const category = await this.categoryService.findOne(id);
    const effectiveProperties =
      await this.categoryService.getEffectiveProperties(id);
    return { ...category, effectiveProperties };
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateEquipmentCategoryDto, @Req() req: any) {
    return this.categoryService.create(dto, req.user.email);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentCategoryDto,
    @Req() req: any,
  ) {
    return this.categoryService.update(id, dto, req.user.email);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  delete(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }

  @Post(':id/upload')
  @Roles(Role.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
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
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('error.noFileUploaded');
    }
    const filename = `${crypto.randomUUID()}${extname(file.originalname)}`;
    const logicalPath = `uploads/equipment-categories/${filename}`;
    await this.fileStorage.putBytes(logicalPath, file.buffer, file.mimetype);
    return this.categoryService.uploadPhoto(id, logicalPath);
  }

  @Post(':id/properties')
  @Roles(Role.SUPER_ADMIN)
  addProperty(
    @Param('id') id: string,
    @Body() dto: CreateCategoryPropertyDto,
    @Req() req: any,
  ) {
    return this.categoryService.addProperty(id, dto, req.user.email);
  }

  @Patch(':id/properties/:propertyId')
  @Roles(Role.SUPER_ADMIN)
  updateProperty(
    @Param('id') id: string,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdateCategoryPropertyDto,
    @Req() req: any,
  ) {
    return this.categoryService.updateProperty(
      id,
      propertyId,
      dto,
      req.user.email,
    );
  }

  @Delete(':id/properties/:propertyId')
  @Roles(Role.SUPER_ADMIN)
  deleteProperty(
    @Param('id') id: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.categoryService.deleteProperty(id, propertyId);
  }
}
