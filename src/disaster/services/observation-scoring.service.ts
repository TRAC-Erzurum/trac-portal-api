import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisasterSetting } from '../entities/disaster-setting.entity';
import { Observation } from '../entities/observation.entity';
import { ObservationFeedback } from '../entities/observation-feedback.entity';
import { ObservationSeverity } from '../enums/observation-severity.enum';
import { ObservationFeedbackType } from '../enums/observation-feedback-type.enum';
import { DisasterMembershipService } from './disaster-membership.service';

@Injectable()
export class ObservationScoringService {
  private configCache: DisasterSetting['config'] | null = null;

  constructor(
    @InjectRepository(DisasterSetting)
    private readonly settingRepository: Repository<DisasterSetting>,
    @InjectRepository(Observation)
    private readonly observationRepository: Repository<Observation>,
    @InjectRepository(ObservationFeedback)
    private readonly feedbackRepository: Repository<ObservationFeedback>,
    private readonly disasterMembershipService: DisasterMembershipService,
  ) {}

  async getConfig(): Promise<DisasterSetting['config']> {
    if (this.configCache) {
      return this.configCache;
    }
    const setting = await this.settingRepository.find({ take: 1 });
    if (!setting.length) {
      throw new Error('Disaster settings not configured');
    }
    this.configCache = setting[0].config;
    return this.configCache;
  }

  clearConfigCache(): void {
    this.configCache = null;
  }

  private severityRank(severity: ObservationSeverity | null): number {
    switch (severity) {
      case ObservationSeverity.LOW:
        return 1;
      case ObservationSeverity.MEDIUM:
        return 2;
      case ObservationSeverity.HIGH:
        return 3;
      case ObservationSeverity.CRITICAL:
        return 4;
      default:
        return 0;
    }
  }

  async rankingScore(observation: Observation): Promise<number> {
    const config = await this.getConfig();
    const confidence = Number(observation.confidenceScore);
    const severity = this.severityRank(observation.severity);
    const referenceTime = observation.eventTime ?? observation.updatedAt;
    const ageHours =
      (Date.now() - new Date(referenceTime).getTime()) / (1000 * 60 * 60);
    const recency =
      Math.pow(0.5, ageHours / config.ranking.recencyHalfLifeHours) * 10;

    return (
      config.ranking.confidenceWeight * confidence +
      config.ranking.severityWeight * severity +
      recency
    );
  }

  async isConflicting(observation: Observation): Promise<boolean> {
    const config = await this.getConfig();
    const total = observation.supportCount + observation.contradictCount;
    if (total === 0) {
      return false;
    }
    return (
      observation.contradictCount >= config.conflict.minContradicts &&
      observation.contradictCount / total >= config.conflict.ratioThreshold
    );
  }

  async recompute(observationId: string): Promise<Observation> {
    const observation = await this.observationRepository.findOne({
      where: { id: observationId },
    });
    if (!observation) {
      return null;
    }

    const config = await this.getConfig();
    const creatorRole =
      await this.disasterMembershipService.getUserDisasterRole(
        observation.disasterId,
        observation.createdByUserId,
      );

    const createWeight =
      config.scoringWeights.create[creatorRole] ??
      config.scoringWeights.create.USER ??
      0;

    const feedbacks = await this.feedbackRepository.find({
      where: { observationId },
    });

    let supportCount = 0;
    let contradictCount = 0;
    let feedbackScore = 0;

    for (const feedback of feedbacks) {
      const giverRole =
        await this.disasterMembershipService.getUserDisasterRole(
          observation.disasterId,
          feedback.userId,
        );

      if (feedback.type === ObservationFeedbackType.SUPPORT) {
        supportCount++;
        feedbackScore +=
          config.scoringWeights.support[giverRole] ??
          config.scoringWeights.support.USER ??
          0;
      } else {
        contradictCount++;
        feedbackScore +=
          config.scoringWeights.contradict[giverRole] ??
          config.scoringWeights.contradict.USER ??
          0;
      }
    }

    observation.confidenceScore = createWeight + feedbackScore;
    observation.supportCount = supportCount;
    observation.contradictCount = contradictCount;

    return this.observationRepository.save(observation);
  }
}
