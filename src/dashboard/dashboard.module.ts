import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { Net } from '../net/entities/net.entity';
import { Attendee } from '../net/entities/attendee.entity';
import { Operator } from '../operator/entities/operator.entity';
import { Activity } from '../activity/entities/activity.entity';
import { OperatorBranchMembership } from '../branch/entities/operator-branch-membership.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Net,
      Attendee,
      Operator,
      Activity,
      OperatorBranchMembership,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
