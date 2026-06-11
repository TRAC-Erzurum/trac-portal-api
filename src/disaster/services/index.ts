import { DisasterService } from './disaster.service';
import { DisasterMembershipService } from './disaster-membership.service';
import { ObservationService } from './observation.service';
import { ObservationFeedbackService } from './observation-feedback.service';
import { ObservationScoringService } from './observation-scoring.service';

export const services = [
  DisasterService,
  DisasterMembershipService,
  ObservationService,
  ObservationFeedbackService,
  ObservationScoringService,
];

export {
  DisasterService,
  DisasterMembershipService,
  ObservationService,
  ObservationFeedbackService,
  ObservationScoringService,
};
