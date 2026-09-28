import { PublicationDeliveryService } from './publication-delivery.service';
import { PublicationQueueClaimer } from './publication-queue-claimer';
import { PublicationWorkerService } from './publication-worker.service';
import { PublicationService } from './publication.service';
import { PublishTargetService } from './publish-target.service';

export const services = [
  PublishTargetService,
  PublicationService,
  PublicationQueueClaimer,
  PublicationDeliveryService,
  PublicationWorkerService,
];

export {
  PublishTargetService,
  PublicationService,
  PublicationQueueClaimer,
  PublicationDeliveryService,
  PublicationWorkerService,
};
