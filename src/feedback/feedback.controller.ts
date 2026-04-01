import {
  Controller,
  Inject,
  Ip,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { GlobalRole } from '../auth/enums/role.enum';
import { AllowWithoutCallsign } from '../auth/decorators/allow-without-callsign.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestWithUser } from '../shared/types/request.types';
import { MAX_UPLOAD_BYTES } from '../shared/constants/upload.constants';
import {
  CAPTCHA_SERVICE,
  CaptchaService,
} from '../auth/services/captcha.interface';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@Roles(GlobalRole.GUEST)
@AllowWithoutCallsign()
export class FeedbackController {
  constructor(
    private readonly feedbackService: FeedbackService,
    @Inject(CAPTCHA_SERVICE) private readonly captchaService: CaptchaService,
  ) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 3 }], {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async submit(
    @Req() req: RequestWithUser,
    @Ip() ip: string,
    @UploadedFiles()
    files: { attachments?: Express.Multer.File[] },
  ) {
    const body = req.body as Record<string, string>;
    await this.captchaService.verify(body.captchaToken, ip);

    const attachments = files?.attachments ?? [];
    return this.feedbackService.submitFeedback(
      req.user,
      body.category ?? '',
      body.summary ?? '',
      body.body ?? '',
      attachments,
    );
  }
}
