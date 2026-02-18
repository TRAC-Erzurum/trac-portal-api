import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { Attendee } from '../net/entities/attendee.entity';
import { Net } from '../net/entities/net.entity';
import { Branch } from '../branch/entities/branch.entity';
import { UserBranchMembership } from '../branch/entities/user-branch-membership.entity';
import { NetScheduler } from '../net-scheduler/entities/net-scheduler.entity';
import { services } from './services';
import { OperatorService } from './services/operator.service';
import { controllers } from './controllers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Operator,
      Attendee,
      Net,
      Branch,
      UserBranchMembership,
      NetScheduler,
    ]),
  ],
  controllers: [...controllers],
  providers: [...services],
  exports: [OperatorService],
})
export class OperatorModule {}
