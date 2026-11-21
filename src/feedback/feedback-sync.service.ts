import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FeedbackGithubService } from './feedback-github.service';

/**
 * Forwards the pending and retryable feedback backlog every 15 minutes. Does
 * nothing (and logs nothing) while the GitHub App is not configured. With
 * several pm2 instances, the advisory lock lets only one run a batch at a time.
 */
@Injectable()
export class FeedbackSyncService {
  private readonly logger = new Logger(FeedbackSyncService.name);
  private running = false;

  constructor(private readonly github: FeedbackGithubService) {}

  @Cron('*/15 * * * *', { name: 'feedback-github-sync' })
  async tick(): Promise<void> {
    if (this.running || !this.github.getConfig()) {
      return;
    }
    this.running = true;
    try {
      const result = await this.github.forwardPendingBatch({ wait: false });
      if (result && result.processed > 0) {
        this.logger.log(
          `Feedback sync: processed ${result.processed}, sent ${result.sent}, failed ${result.failed}`,
        );
      }
    } catch (e) {
      this.logger.error(`Feedback sync failed: ${(e as Error).name}`);
    } finally {
      this.running = false;
    }
  }
}
