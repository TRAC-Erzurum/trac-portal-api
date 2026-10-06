import { PublicationDeliveryService } from './publication-delivery.service';
import { PublicationQueueClaimer } from './publication-queue-claimer';
import { PublicationWorkerService } from './publication-worker.service';
import { PublicationService } from './publication.service';

export const services = [
  PublicationService,
  PublicationQueueClaimer,
  PublicationDeliveryService,
  PublicationWorkerService,
];

export {
  PublicationService,
  PublicationQueueClaimer,
  PublicationDeliveryService,
  PublicationWorkerService,
};
