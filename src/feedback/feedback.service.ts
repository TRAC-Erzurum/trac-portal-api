import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { AuthUser } from '../auth/types/auth.types';
import { FileStorageService } from '../shared/storage/file-storage.service';
import {
  ALLOWED_FEEDBACK_IMAGE_MIMES,
  MAX_FEEDBACK_BODY_LENGTH,
  MAX_FEEDBACK_SUMMARY_LENGTH,
  mimeToExt,
} from './feedback.constants';
import { Feedback } from './entities/feedback.entity';
import { FeedbackGithubStatus } from './enums/feedback-github-status.enum';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import { FeedbackGithubService } from './feedback-github.service';
import { isFeedbackCategory } from './feedback.types';

const MAX_FEEDBACK_ATTACHMENTS = 3;
const DEFAULT_FEEDBACK_LIST_LIMIT = 50;

export interface FeedbackSubmitResult {
  success: true;
  id: string;
  issueUrl?: string;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly fileStorage: FileStorageService,
    @InjectRepository(Feedback)
    private readonly feedbackRepository: Repository<Feedback>,
    private readonly github: FeedbackGithubService,
  ) {}

  /**
   * Saves the submission first, then forwards it to GitHub unless it is a
   * security report. The request succeeds even when forwarding fails: the
   * record keeps the failure and can be retried later.
   */
  async submitFeedback(
    user: AuthUser,
    categoryRaw: string,
    summaryRaw: string,
    bodyRaw: string,
    files: Express.Multer.File[],
  ): Promise<FeedbackSubmitResult> {
    if (!isFeedbackCategory(categoryRaw)) {
      throw new BadRequestException('error.feedbackInvalidCategory');
    }
    const category = categoryRaw;

    const summary = (summaryRaw ?? '').trim();
    const body = (bodyRaw ?? '').trim();
    if (!summary.length) {
      throw new BadRequestException('error.invalidData');
    }
    if (summary.length > MAX_FEEDBACK_SUMMARY_LENGTH) {
      throw new BadRequestException('error.feedbackSummaryTooLong');
    }
    if (!body.length) {
      throw new BadRequestException('error.invalidData');
    }
    if (body.length > MAX_FEEDBACK_BODY_LENGTH) {
      throw new BadRequestException('error.feedbackBodyTooLarge');
    }
    if (files.length > MAX_FEEDBACK_ATTACHMENTS) {
      throw new BadRequestException('error.feedbackAttachmentRejected');
    }

    const uploadedPaths = await this.storeAttachments(files);

    let record: Feedback;
    try {
      record = await this.feedbackRepository.save(
        this.feedbackRepository.create({
          userId: user.id,
          callSign: user.callSign?.trim() || null,
          category,
          summary,
          body,
          attachmentPaths: uploadedPaths,
          githubStatus:
            category === 'security'
              ? FeedbackGithubStatus.SKIPPED
              : FeedbackGithubStatus.PENDING,
          githubAttempts: 0,
        }),
      );
    } catch (e) {
      // Attachments are removed only when the record itself was not saved.
      await this.removeAttachments(uploadedPaths);
      this.logger.error(`Feedback save failed: ${(e as Error).name}`);
      throw new InternalServerErrorException('error.internal');
    }

    if (record.githubStatus === FeedbackGithubStatus.PENDING) {
      try {
        await this.github.forwardNewRecord(record);
      } catch (e) {
        // The record is saved as pending and the sync job retries it.
        this.logger.warn(
          `Feedback ${record.id} saved; forwarding not recorded: ${(e as Error).name}`,
        );
      }
    }

    return {
      success: true,
      id: record.id,
      ...(record.githubIssueUrl ? { issueUrl: record.githubIssueUrl } : {}),
    };
  }

  async list(query: ListFeedbackQueryDto) {
    const limit = query.limit ?? DEFAULT_FEEDBACK_LIST_LIMIT;
    const offset = query.offset ?? 0;
    const [data, total] = await this.feedbackRepository.findAndCount({
      where: {
        ...(query.category && { category: query.category }),
        ...(query.githubStatus && { githubStatus: query.githubStatus }),
      },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string): Promise<Feedback> {
    const record = await this.feedbackRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('error.notFound');
    }
    return record;
  }

  /** Stores uploaded images. On any failure the images already stored are removed. */
  private async storeAttachments(
    files: Express.Multer.File[],
  ): Promise<string[]> {
    const uploadedPaths: string[] = [];
    try {
      for (const file of files) {
        const ft = await fileTypeFromBuffer(file.buffer);
        const mime = ft?.mime ?? file.mimetype;
        if (!ALLOWED_FEEDBACK_IMAGE_MIMES.has(mime)) {
          throw new BadRequestException('error.feedbackAttachmentRejected');
        }
        const logicalPath = `uploads/feedback/${randomUUID()}.${mimeToExt(mime)}`;
        await this.fileStorage.putBytes(logicalPath, file.buffer, mime);
        uploadedPaths.push(logicalPath);
      }
      return uploadedPaths;
    } catch (e) {
      await this.removeAttachments(uploadedPaths);
      if (e instanceof BadRequestException) {
        throw e;
      }
      this.logger.error(
        `Feedback attachment storage failed: ${(e as Error).name}`,
      );
      throw new InternalServerErrorException('error.internal');
    }
  }

  private async removeAttachments(paths: string[]): Promise<void> {
    for (const p of paths) {
      try {
        await this.fileStorage.delete(p);
      } catch (delErr) {
        this.logger.warn(
          `Feedback attachment cleanup failed for ${p}: ${(delErr as Error).name}`,
        );
      }
    }
  }
}
