import { Attendee } from './attendee.entity';
import { Net } from './net.entity';
import { NetCommunicationChannel } from './net-communication-channel.entity';
import { ReportShareToken } from './report-share-token.entity';
import { NetScheduler } from '../../net-scheduler/entities/net-scheduler.entity';

export const entities = [
  Net,
  Attendee,
  NetCommunicationChannel,
  ReportShareToken,
  NetScheduler,
];
