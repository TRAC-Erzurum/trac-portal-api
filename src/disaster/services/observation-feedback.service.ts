import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  ActivityEvent,
  ACTIVITY_EVENT,
} from '../../activity/events/activity.events';
import {
  ActivityType,
  EntityType,
} from '../../activity/enums/activity-type.enum';
import { Observation } from '../entities/observation.entity';
import { ObservationFeedback } from '../entities/observation-feedback.entity';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import { ObservationFeedbackType } from '../enums/observation-feedback-type.enum';
import { DisasterService } from './disaster.service';
import { ObservationScoringService } from './observation-scoring.service';

@Injectable()
export class ObservationFeedbackService {
  constructor(
    @InjectRepository(Observation)
    private readonly observationRepository: Repository<Observation>,
    @InjectRepository(ObservationFeedback)
    private readonly feedbackRepository: Repository<ObservationFeedback>,
    private readonly disasterService: DisasterService,
    private readonly scoringService: ObservationScoringService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private async getObservationOrFail(id: string): Promise<Observation> {
    const observation = await this.observationRepository.findOne({
      where: { id },
    });
    if (!observation) {
      throw new NotFoundException('error.notFound');
    }
    const disaster = await this.disasterService.findOne(observation.disasterId);
    this.disasterService.assertNotArchived(disaster);
    return observation;
  }

  async upsert(
    observationId: string,
    userId: string,
    dto: CreateFeedbackDto,
    actorEmail: string,
    actorCallSign?: string,
  ): Promise<ObservationFeedback> {
    const observation = await this.getObservationOrFail(observationId);
    if (observation.createdByUserId === userId) {
      throw new ForbiddenException('error.cannotVoteOwnObservation');
    }

    let feedback = await this.feedbackRepository.findOne({
      where: { observationId, userId },
    });

    const isNew = !feedback;
    if (feedback) {
      feedback.type = dto.type;
      feedback.updatedBy = [...(feedback.updatedBy || []), actorEmail];
    } else {
      feedback = this.feedbackRepository.create({
        observationId,
        userId,
        type: dto.type,
        createdBy: actorEmail,
        updatedBy: [],
      });
    }

    const saved = await this.feedbackRepository.save(feedback);
    await this.scoringService.recompute(observationId);

    const activityType =
      dto.type === ObservationFeedbackType.SUPPORT
        ? ActivityType.OBSERVATION_SUPPORTED
        : ActivityType.OBSERVATION_CONTRADICTED;

    this.eventEmitter.emit(
      ACTIVITY_EVENT,
      new ActivityEvent(
        activityType,
        EntityType.OBSERVATION,
        observationId,
        userId,
        actorCallSign ?? null,
        null,
        { feedbackType: dto.type, isNew },
      ),
    );

    return saved;
  }

  async remove(observationId: string, userId: string): Promise<void> {
    await this.getObservationOrFail(observationId);

    const feedback = await this.feedbackRepository.findOne({
      where: { observationId, userId },
    });
    if (!feedback) {
      throw new NotFoundException('error.notFound');
    }

    await this.feedbackRepository.remove(feedback);
    await this.scoringService.recompute(observationId);
  }
}
