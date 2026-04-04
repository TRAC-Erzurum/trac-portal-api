import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { Attendee } from '../net/entities/attendee.entity';
import { Net } from '../net/entities/net.entity';
import { Branch } from '../branch/entities/branch.entity';
import { BranchCallSign } from '../branch/entities/branch-call-sign.entity';
import { OperatorBranchMembership } from '../branch/entities/operator-branch-membership.entity';
import { NetScheduler } from '../net-scheduler/entities/net-scheduler.entity';
import { services } from './services';
import { OperatorService } from './services/operator.service';
import { controllers } from './controllers';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [
    forwardRef(() => BranchModule),
    TypeOrmModule.forFeature([
      Operator,
      Attendee,
      Net,
      Branch,
      BranchCallSign,
      OperatorBranchMembership,
      NetScheduler,
    ]),
  ],
  controllers: [...controllers],
  providers: [...services],
  exports: [OperatorService],
})
export class OperatorModule {}
