import { Module, forwardRef } from '@nestjs/common';
import { PortalOrBranchLeaderGuard } from './guards/portal-or-branch-leader.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { services } from './services';
import { controllers } from './controllers';
import { User } from '../user/entities/user.entity';
import { Net } from '../net/entities/net.entity';
import { Operator } from '../operator/entities/operator.entity';
import { NetScheduler } from '../net-scheduler/entities/net-scheduler.entity';
import { BranchAdminGuard } from './guards/branch-admin.guard';
import { BranchMemberGuard } from './guards/branch-member.guard';
import { CreateBranchGuard } from './guards/create-branch.guard';
import { UserModule } from '../user/user.module';
import { OperatorModule } from '../operator/operator.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([...entities, User, Net, Operator, NetScheduler]),
    forwardRef(() => UserModule),
    forwardRef(() => OperatorModule),
  ],
  controllers: [...controllers],
  providers: [
    ...services,
    BranchAdminGuard,
    BranchMemberGuard,
    CreateBranchGuard,
    PortalOrBranchLeaderGuard,
  ],
  exports: [...services, PortalOrBranchLeaderGuard, BranchAdminGuard],
})
export class BranchModule {}
