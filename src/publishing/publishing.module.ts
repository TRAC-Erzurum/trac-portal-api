import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservationPhoto } from '../disaster/entities/observation-photo.entity';
import { Observation } from '../disaster/entities/observation.entity';
import { Disaster } from '../disaster/entities/disaster.entity';
import { UserModule } from '../user/user.module';
import { controllers } from './controllers';
import { entities } from './entities';
import {
  DEFAULT_PHOTO_GRACE_MS,
  PUBLISHING_CLOCK,
  PUBLISHING_PHOTO_GRACE_MS,
  PublishingClock,
} from './publishing.constants';
import { services } from './services';

/** Publishes disaster observations to registered external targets. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...entities,
      Disaster,
      Observation,
      ObservationPhoto,
    ]),
    UserModule,
  ],
  controllers: [...controllers],
  providers: [
    ...services,
    {
      provide: PUBLISHING_CLOCK,
      useValue: (() => new Date()) as PublishingClock,
    },
    { provide: PUBLISHING_PHOTO_GRACE_MS, useValue: DEFAULT_PHOTO_GRACE_MS },
  ],
  exports: [...services],
})
export class PublishingModule {}
