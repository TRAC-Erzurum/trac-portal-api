import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NetScheduler } from '../entities/net-scheduler.entity';
import { NetSchedulerService } from './net-scheduler.service';
import { NetService } from '../../net/services/net.service';

/** GMT+3 today as YYYY-MM-DD. */
function getTodayGMT3(): string {
  const now = new Date();
  const gmt3 = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  const y = gmt3.getFullYear();
  const m = String(gmt3.getMonth() + 1).padStart(2, '0');
  const d = String(gmt3.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** GMT+3 yesterday as YYYY-MM-DD. */
function getYesterdayGMT3(): string {
  const now = new Date();
  const gmt3 = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
  gmt3.setDate(gmt3.getDate() - 1);
  const y = gmt3.getFullYear();
  const m = String(gmt3.getMonth() + 1).padStart(2, '0');
  const d = String(gmt3.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable()
export class NetSchedulerCronService {
  constructor(
    @InjectRepository(NetScheduler)
    private readonly schedulerRepository: Repository<NetScheduler>,
    private readonly netSchedulerService: NetSchedulerService,
    private readonly netService: NetService,
  ) {}

  /** Runs daily at 00:00 GMT+3 (Europe/Istanbul). */
  @Cron('0 0 * * *', { timeZone: 'Europe/Istanbul' })
  async runDaily() {
    const today = getTodayGMT3();
    const yesterday = getYesterdayGMT3();

    await this.createNetsForToday(today);
    await this.netService.cancelPendingNetsForDate(yesterday);
  }

  private async createNetsForToday(todayStr: string) {
    const schedulers = await this.schedulerRepository.find({
      where: { isActive: true },
      relations: ['branch', 'operator', 'branchCallSign', 'communicationChannels', 'communicationChannels.communicationChannel'],
    });

    for (const scheduler of schedulers) {
      try {
        await this.netSchedulerService.createNetsForSchedulerForDate(
          scheduler,
          todayStr,
          'tr',
        );
      } catch (err) {
        console.error(
          `NetSchedulerCron: create net for scheduler ${scheduler.id} on ${todayStr}`,
          err,
        );
      }
    }
  }
}
