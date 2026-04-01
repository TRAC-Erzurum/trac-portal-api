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
import { writeFile } from 'fs/promises';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname, join } from 'path';
import { Roles } from '../../auth/decorators/roles.decorator';
import { FileStorageService } from '../../shared/storage';
import { MAX_UPLOAD_BYTES } from '../../shared/constants/upload.constants';
import { GlobalRole, BranchRole } from '../../auth/enums/role.enum';
import { EquipmentCategoryService } from '../services/equipment-category.service';
import {
  CreateEquipmentCategoryDto,
  UpdateEquipmentCategoryDto,
  CreateCategoryPropertyDto,
  UpdateCategoryPropertyDto,
} from '../dto';

@Controller('equipment-categories')
@Roles(BranchRole.VOLUNTEER)
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
  @Roles(GlobalRole.SUPER_ADMIN)
  create(@Body() dto: CreateEquipmentCategoryDto, @Req() req: any) {
    return this.categoryService.create(dto, req.user.email);
  }

  @Patch(':id')
  @Roles(GlobalRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentCategoryDto,
    @Req() req: any,
  ) {
    return this.categoryService.update(id, dto, req.user.email);
  }

  @Delete(':id')
  @Roles(GlobalRole.SUPER_ADMIN)
  delete(@Param('id') id: string) {
    return this.categoryService.delete(id);
  }

  @Post(':id/upload')
  @Roles(GlobalRole.SUPER_ADMIN)
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
    const absolutePath = join(process.cwd(), logicalPath);
    await writeFile(absolutePath, file.buffer);
    return this.categoryService.uploadPhoto(id, logicalPath);
  }

  @Post(':id/properties')
  @Roles(GlobalRole.SUPER_ADMIN)
  addProperty(
    @Param('id') id: string,
    @Body() dto: CreateCategoryPropertyDto,
    @Req() req: any,
  ) {
    return this.categoryService.addProperty(id, dto, req.user.email);
  }

  @Patch(':id/properties/:propertyId')
  @Roles(GlobalRole.SUPER_ADMIN)
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
  @Roles(GlobalRole.SUPER_ADMIN)
  deleteProperty(
    @Param('id') id: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.categoryService.deleteProperty(id, propertyId);
  }
}
