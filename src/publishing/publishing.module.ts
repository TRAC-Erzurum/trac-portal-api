import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Observation } from '../disaster/entities/observation.entity';
import { Disaster } from '../disaster/entities/disaster.entity';
import { UserModule } from '../user/user.module';
import { controllers } from './controllers';
import { entities } from './entities';
import { PUBLISHING_CLOCK, PublishingClock } from './publishing.constants';
import { services } from './services';

/** Publishes disaster observations to registered external targets. */
@Module({
  imports: [
    TypeOrmModule.forFeature([...entities, Disaster, Observation]),
    UserModule,
  ],
  controllers: [...controllers],
  providers: [
    ...services,
    {
      provide: PUBLISHING_CLOCK,
      useValue: (() => new Date()) as PublishingClock,
    },
  ],
  exports: [...services],
})
export class PublishingModule {}
