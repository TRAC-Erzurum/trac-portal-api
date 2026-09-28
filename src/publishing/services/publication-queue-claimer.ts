import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PublicationQueueItem } from '../entities/publication-queue-item.entity';

/** A disaster whose publishing is on, with the usable target it publishes to. */
export interface EligiblePair {
  disasterId: string;
  targetId: string;
}

/**
 * Claims due rows for delivery. The API runs as a pm2 cluster, so rows are
 * selected `FOR UPDATE SKIP LOCKED` and leased (`nextAttemptAt` pushed to
 * `leaseUntil`) in one statement: two instances never claim the same row,
 * and a row whose sender died becomes due again when the lease runs out.
 */
@Injectable()
export class PublicationQueueClaimer {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async claim(
    now: Date,
    leaseUntil: Date,
    limit: number,
    pairs: EligiblePair[],
  ): Promise<PublicationQueueItem[]> {
    if (pairs.length === 0 || limit <= 0) return [];
    const result: unknown = await this.dataSource.query(
      `UPDATE "publication_queue" AS q
          SET "nextAttemptAt" = $2, "updatedAt" = now()
        WHERE q."id" IN (
          SELECT c."id" FROM "publication_queue" AS c
           WHERE c."status" = 'PENDING'
             AND c."nextAttemptAt" <= $1
             AND (c."disasterId", c."targetId") IN (
               SELECT * FROM unnest($3::uuid[], $4::uuid[])
             )
           ORDER BY c."nextAttemptAt", c."createdAt"
           LIMIT $5
           FOR UPDATE SKIP LOCKED
        )
        RETURNING q.*`,
      [
        now,
        leaseUntil,
        pairs.map((p) => p.disasterId),
        pairs.map((p) => p.targetId),
        limit,
      ],
    );
    // The postgres driver returns [rows, affectedCount] for UPDATE ... RETURNING.
    const rows = (
      Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
    ) as PublicationQueueItem[];
    return rows.map((r) => ({
      ...r,
      nextAttemptAt: new Date(r.nextAttemptAt),
      createdAt: new Date(r.createdAt),
    }));
  }
}
