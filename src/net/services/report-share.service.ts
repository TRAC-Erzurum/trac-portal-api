import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { ReportShareToken } from '../entities/report-share-token.entity';
import { NetService } from './net.service';
import { Attendee } from '../entities/attendee.entity';

const TTL_HOURS = 1;

export interface ReportShareData {
  net: {
    id: string;
    name: string;
    startedAt?: string;
    endedAt?: string;
    operator: { callSign: string };
    branch?: { name: string; isHeadquarters?: boolean };
    branchCallSign?: { callSign: string } | null;
    communicationChannels?: Array<{
      id: string;
      isSimplexAdHoc?: boolean;
      simplexFrequency?: string;
      communicationChannel?: {
        id: string
        type: string
        txFrequency?: number | null
        rxFrequency?: number | null
        echolinkNode?: string | null
        echolinkName?: string | null
      };
    }>;
  };
  attendees: Array<{
    id: string;
    callSign: string;
    name?: string | null;
    city?: string | null;
    district?: string | null;
    readability?: number | null;
    signalStrength?: number | null;
    createdAt: string;
  }>;
}

@Injectable()
export class ReportShareService {
  private readonly consumedToken$ = new Subject<string>();

  constructor(
    @InjectRepository(ReportShareToken)
    private readonly reportShareTokenRepository: Repository<ReportShareToken>,
    @InjectRepository(Attendee)
    private readonly attendeeRepository: Repository<Attendee>,
    private readonly netService: NetService,
  ) {}

  /**
   * SSE stream: emits { token } when a share link is validated and consumed.
   * Clients (e.g. sheet open on net detail) use this to close the share sheet.
   */
  getConsumedTokenStream(): Observable<{ data: { token: string } }> {
    return this.consumedToken$.pipe(
      map((token) => ({ data: { token } })),
    );
  }

  async createToken(netId: string): Promise<string> {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
    const record = this.reportShareTokenRepository.create({
      token,
      netId,
      expiresAt,
    });
    await this.reportShareTokenRepository.save(record);
    return token;
  }

  /**
   * Validates token, loads net + attendees, consumes token (one-time), returns data.
   */
  async getReportDataAndConsume(token: string): Promise<ReportShareData> {
    if (!token || token.includes('..') || token.includes('/')) {
      throw new NotFoundException('error.notFound');
    }
    const record = await this.reportShareTokenRepository.findOne({
      where: { token },
    });
    if (!record) {
      throw new NotFoundException('error.notFound');
    }
    if (new Date() > record.expiresAt) {
      await this.reportShareTokenRepository.remove(record);
      throw new NotFoundException('error.notFound');
    }
    const netId = record.netId;
    const consumedToken = record.token;
    await this.reportShareTokenRepository.remove(record);

    this.consumedToken$.next(consumedToken);

    const net = await this.netService.findOne(netId);
    const attendees = await this.attendeeRepository.find({
      where: { net: { id: netId } },
      order: { createdAt: 'ASC' },
    });

    const netData = {
      id: net.id,
      name: net.name,
      startedAt: net.startedAt?.toISOString?.() ?? (net as any).startedAt,
      endedAt: net.endedAt?.toISOString?.() ?? (net as any).endedAt,
      operator: { callSign: net.operator?.callSign ?? '' },
      branch: net.branch
        ? { name: net.branch.name, isHeadquarters: net.branch.isHeadquarters }
        : undefined,
      branchCallSign: net.branchCallSign
        ? { callSign: net.branchCallSign.callSign }
        : null,
      communicationChannels: (net as any).communicationChannels?.map(
        (ch: any) => ({
          id: ch.id,
          isSimplexAdHoc: ch.isSimplexAdHoc,
          simplexFrequency: ch.simplexFrequency,
          communicationChannel: ch.communicationChannel
            ? {
                id: ch.communicationChannel.id,
                type: ch.communicationChannel.type,
                txFrequency: ch.communicationChannel.txFrequency,
                rxFrequency: ch.communicationChannel.rxFrequency,
                echolinkNode: ch.communicationChannel.echolinkNode,
                echolinkName: ch.communicationChannel.echolinkName,
              }
            : undefined,
        }),
      ),
    };

    const attendeesData = attendees.map((a) => ({
      id: a.id,
      callSign: a.callSign,
      name: a.name ?? null,
      city: a.city ?? null,
      district: a.district ?? null,
      readability: a.readability ?? null,
      signalStrength: a.signalStrength ?? null,
      createdAt:
        (a as any).createdAt?.toISOString?.() ?? String((a as any).createdAt),
    }));

    return { net: netData, attendees: attendeesData };
  }
}
