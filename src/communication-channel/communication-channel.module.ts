import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchModule } from '../branch/branch.module';
import { entities } from './entities';
import { services } from './services';
import { controllers } from './controllers';
import { BranchCommunicationChannelAdminGuard } from './guards/branch-communication-channel-admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([...entities]), BranchModule],
  controllers: [...controllers],
  providers: [...services, BranchCommunicationChannelAdminGuard],
  exports: [...services],
})
export class CommunicationChannelModule {}
