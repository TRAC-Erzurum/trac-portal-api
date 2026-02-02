import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { DashboardV2Controller } from './controllers/dashboard-v2.controller';
import { DashboardV2Service } from './services/dashboard-v2.service';
import { Net } from '../net/entities/net.entity';
import { Attendee } from '../net/entities/attendee.entity';
import { Operator } from '../operator/entities/operator.entity';
import { Activity } from '../activity/entities/activity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Net, Attendee, Operator, Activity])],
  controllers: [DashboardController, DashboardV2Controller],
  providers: [DashboardService, DashboardV2Service],
})
export class DashboardModule {}
