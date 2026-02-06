import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { services } from './services';
import { controllers } from './controllers';
import { User } from '../user/entities/user.entity';
import { Net } from '../net/entities/net.entity';
import { BranchAdminGuard } from './guards/branch-admin.guard';
import { BranchMemberGuard } from './guards/branch-member.guard';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([...entities, User, Net]),
    forwardRef(() => UserModule),
  ],
  controllers: [...controllers],
  providers: [...services, BranchAdminGuard, BranchMemberGuard],
  exports: [...services],
})
export class BranchModule {}
