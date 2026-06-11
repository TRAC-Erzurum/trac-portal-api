import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { AllowWithoutCallsign } from '../../auth/decorators/allow-without-callsign.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GlobalRole } from '../../auth/enums/role.enum';
import { FileStorageService } from '../../shared/storage';
import { MAX_UPLOAD_BYTES } from '../../shared/constants/upload.constants';
import { RequestWithUser } from '../../shared/types/request.types';
import { CreateFeedbackDto } from '../dto';
import { ObservationService } from '../services/observation.service';
import { ObservationFeedbackService } from '../services/observation-feedback.service';

@Controller('observation')
@Roles(GlobalRole.GUEST)
export class ObservationController {
  constructor(
    private readonly observationService: ObservationService,
    private readonly feedbackService: ObservationFeedbackService,
    private readonly fileStorage: FileStorageService,
  ) {}

  @Get(':id')
  @AllowWithoutCallsign()
  findOne(@Param('id') id: string) {
    return this.observationService.findOneWithChildren(id);
  }

  @Post(':id/photos')
  @AllowWithoutCallsign()
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|webp)$/i)) {
          return cb(new BadRequestException('error.invalidFileType'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async uploadPhotos(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('error.noFileUploaded');
    }
    const filePaths: string[] = [];
    for (const file of files) {
      const filename = `${crypto.randomUUID()}${extname(file.originalname)}`;
      const logicalPath = `uploads/observations/${filename}`;
      await this.fileStorage.putBytes(logicalPath, file.buffer, file.mimetype);
      filePaths.push(logicalPath);
    }
    return this.observationService.uploadPhotos(id, filePaths);
  }

  @Post(':id/feedback')
  @AllowWithoutCallsign()
  upsertFeedback(
    @Param('id') id: string,
    @Body() dto: CreateFeedbackDto,
    @Req() req: RequestWithUser,
  ) {
    return this.feedbackService.upsert(
      id,
      req.user.id,
      dto,
      req.user.email,
      req.user.callSign,
    );
  }

  @Delete(':id/feedback')
  @AllowWithoutCallsign()
  removeFeedback(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.feedbackService.remove(id, req.user.id);
  }
}
