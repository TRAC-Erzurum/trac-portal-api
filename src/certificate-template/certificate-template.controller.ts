import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { CertificateTemplateService } from './certificate-template.service';
import { FileStorageService } from '../shared/storage';
import { MAX_UPLOAD_BYTES } from '../shared/constants/upload.constants';
import { CreateCertificateTemplateDto } from './dto/create-certificate-template.dto';
import { UpdateCertificateTemplateDto } from './dto/update-certificate-template.dto';
import { BranchAdminGuard } from '../branch/guards/branch-admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { RequestWithUser } from '../shared/types/request.types';

@Controller('branches/:branchId/certificate-templates')
export class CertificateTemplateController {
  constructor(
    private readonly certificateTemplateService: CertificateTemplateService,
    private readonly fileStorage: FileStorageService,
  ) {}

  @Get()
  async findByBranchId(@Param('branchId') branchId: string) {
    return this.certificateTemplateService.findByBranchId(branchId);
  }

  @Get(':id')
  async findOne(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
  ) {
    return this.certificateTemplateService.findOne(id, branchId);
  }

  @Post('upload')
  @UseGuards(BranchAdminGuard)
  @Roles(Role.GUEST)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
        if (!allowedExts.includes(ext)) {
          return callback(
            new BadRequestException('error.invalidFileType'),
            false,
          );
        }
        callback(null, true);
      },
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async uploadImage(
    @Param('branchId') branchId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('error.noFileUploaded');
    }
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/x-png',
      'image/webp',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('error.invalidFileType');
    }
    const filename = `${crypto.randomUUID()}${extname(file.originalname)}`;
    const logicalPath = `uploads/certificate-templates/${filename}`;
    await this.fileStorage.putBytes(logicalPath, file.buffer, file.mimetype);
    return { imagePath: `/uploads/certificate-templates/${filename}` };
  }

  @Post()
  @UseGuards(BranchAdminGuard)
  @Roles(Role.GUEST)
  async create(
    @Param('branchId') branchId: string,
    @Body() dto: CreateCertificateTemplateDto,
    @Req() req: RequestWithUser,
  ) {
    return this.certificateTemplateService.create(
      branchId,
      dto,
      req.user.email,
    );
  }

  @Patch(':id')
  @UseGuards(BranchAdminGuard)
  @Roles(Role.GUEST)
  async update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCertificateTemplateDto,
    @Req() req: RequestWithUser,
  ) {
    return this.certificateTemplateService.update(
      id,
      branchId,
      dto,
      req.user.email,
    );
  }

  @Delete(':id')
  @UseGuards(BranchAdminGuard)
  @Roles(Role.GUEST)
  async remove(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.certificateTemplateService.remove(
      id,
      branchId,
      force === 'true',
    );
  }

  @Get(':id/nets-using')
  @UseGuards(BranchAdminGuard)
  @Roles(Role.GUEST)
  async getNetsUsing(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
  ) {
    await this.certificateTemplateService.findOne(id, branchId);
    return this.certificateTemplateService.getNetsUsingTemplate(id);
  }
}
