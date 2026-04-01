import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Octokit } from '@octokit/rest';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { AuthUser } from '../auth/types/auth.types';
import { FileStorageService } from '../shared/storage/file-storage.service';
import { UserBranchMembership } from '../branch/entities/user-branch-membership.entity';
import { MembershipStatus } from '../branch/enums/membership-status.enum';
import {
  ALLOWED_FEEDBACK_IMAGE_MIMES,
  buildFeedbackIssueTitle,
  FEEDBACK_LABEL_BY_CATEGORY,
  FEEDBACK_LABEL_PRODUCT,
  MAX_FEEDBACK_BODY_LENGTH,
  MAX_FEEDBACK_SUMMARY_LENGTH,
  mimeToExt,
} from './feedback.constants';
import { FeedbackCategory, isFeedbackCategory } from './feedback.types';
import { parseGithubRepoWebUrl } from './utils/parse-github-repo';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly fileStorage: FileStorageService,
    @InjectRepository(UserBranchMembership)
    private readonly membershipRepository: Repository<UserBranchMembership>,
  ) {}

  private getPublicOrigin(): string {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const domain = this.configService.get<string>('DOMAIN');
    const port = this.configService.get<number>('PORT') || 8000;
    if (nodeEnv === 'production' && domain) {
      return `https://${domain}`;
    }
    return `http://localhost:${port}`;
  }

  private assertFeedbackConfigured(): { token: string; owner: string; repo: string } {
    const token =
      this.configService.get<string>('GITHUB_FEEDBACK_TOKEN')?.trim() ||
      process.env.GITHUB_FEEDBACK_TOKEN?.trim();
    const repoUrl =
      this.configService.get<string>('GITHUB_REPO_WEB_URL') ||
      process.env.GITHUB_REPO_WEB_URL;
    const parsed = parseGithubRepoWebUrl(repoUrl);
    if (!token || !parsed) {
      throw new ServiceUnavailableException('error.feedbackNotConfigured');
    }
    return { token, owner: parsed.owner, repo: parsed.repo };
  }

  async countApprovedMemberships(userId: string): Promise<number> {
    return this.membershipRepository.count({
      where: { userId, status: MembershipStatus.APPROVED },
    });
  }

  async submitFeedback(
    user: AuthUser,
    categoryRaw: string,
    summaryRaw: string,
    bodyRaw: string,
    files: Express.Multer.File[],
  ): Promise<{ success: true; issueUrl: string }> {
    const { token, owner, repo } = this.assertFeedbackConfigured();

    if (!isFeedbackCategory(categoryRaw)) {
      throw new BadRequestException('error.feedbackInvalidCategory');
    }
    const category = categoryRaw as FeedbackCategory;

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

    const maxFiles = 3;
    if (files.length > maxFiles) {
      throw new BadRequestException('error.feedbackAttachmentRejected');
    }

    const uploadedPaths: string[] = [];
    const origin = this.getPublicOrigin();

    try {
      for (const file of files) {
        const ft = await fileTypeFromBuffer(file.buffer);
        const mime = ft?.mime ?? file.mimetype;
        if (!ALLOWED_FEEDBACK_IMAGE_MIMES.has(mime)) {
          throw new BadRequestException('error.feedbackAttachmentRejected');
        }
        const ext = mimeToExt(mime);
        const logicalPath = `uploads/feedback/${randomUUID()}.${ext}`;
        await this.fileStorage.putBytes(logicalPath, file.buffer, mime);
        uploadedPaths.push(logicalPath);
      }

      const approvedCount = await this.countApprovedMemberships(user.id);

      const title = buildFeedbackIssueTitle(category, user.callSign, summary);
      const issueBody = this.buildIssueMarkdown(
        user,
        body,
        uploadedPaths,
        origin,
        approvedCount,
      );

      const labels = [
        FEEDBACK_LABEL_BY_CATEGORY[category],
        FEEDBACK_LABEL_PRODUCT,
      ];

      const octokit = new Octokit({ auth: token });
      const created = await octokit.rest.issues.create({
        owner,
        repo,
        title,
        body: issueBody,
        labels,
      });

      const issueUrl = created.data.html_url;
      return { success: true, issueUrl };
    } catch (e) {
      for (const p of uploadedPaths) {
        try {
          await this.fileStorage.delete(p);
        } catch (delErr) {
          this.logger.warn(`Feedback R2 rollback failed for ${p}: ${delErr}`);
        }
      }

      if (
        e instanceof BadRequestException ||
        e instanceof ServiceUnavailableException
      ) {
        throw e;
      }

      this.logger.error('GitHub issues.create failed', e);
      throw new BadRequestException('error.feedbackGithubFailed');
    }
  }

  private buildIssueMarkdown(
    user: AuthUser,
    body: string,
    imageLogicalPaths: string[],
    origin: string,
    approvedMembershipCount: number,
  ): string {
    const lines: string[] = [];
    lines.push('## Portal');
    lines.push(`- Kullanıcı ID: \`${user.id}\``);
    lines.push(
      `- Çağrı işareti: ${user.callSign?.trim() ? user.callSign.trim() : '—'}`,
    );
    lines.push(`- Rol: \`${user.role}\``);
    lines.push(
      `- Geçerli şube ID: ${user.currentBranchId != null && user.currentBranchId !== '' ? `\`${user.currentBranchId}\`` : '—'}`,
    );
    lines.push(`- Onaylı şube üyeliği sayısı: ${approvedMembershipCount}`);
    lines.push(
      `- Operatör ID: ${user.operatorId ? `\`${user.operatorId}\`` : '—'}`,
    );
    lines.push(`- Zaman (UTC): ${new Date().toISOString()}`);
    lines.push('');
    lines.push('## Açıklama');
    lines.push(body);
    lines.push('');
    if (imageLogicalPaths.length > 0) {
      lines.push('## Ekran görüntüleri');
      for (const p of imageLogicalPaths) {
        const sub = p.replace(/^uploads\//, '');
        lines.push(`![](${origin}/uploads/${sub})`);
      }
    }
    return lines.join('\n');
  }
}
