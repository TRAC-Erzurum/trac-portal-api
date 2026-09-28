import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  DELIVERY_BATCH_SIZE,
  DELIVERY_INTERVAL_MS,
} from '../publishing.constants';
import { PublicationDeliveryService } from './publication-delivery.service';

/** Most batches one tick works through before leaving the rest to the next tick. */
const MAX_BATCHES_PER_TICK = 10;

/** Scheduled delivery of due queue rows (runs on every pm2 instance; claims keep them apart). */
@Injectable()
export class PublicationWorkerService {
  private readonly logger = new Logger(PublicationWorkerService.name);
  private running = false;

  constructor(private readonly delivery: PublicationDeliveryService) {}

  @Interval('publication-delivery', DELIVERY_INTERVAL_MS)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < MAX_BATCHES_PER_TICK; i++) {
        const { claimed } = await this.delivery.deliverDue();
        if (claimed < DELIVERY_BATCH_SIZE) break;
      }
    } catch (error) {
      this.logger.error(
        `Publication delivery failed: ${(error as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }
}
