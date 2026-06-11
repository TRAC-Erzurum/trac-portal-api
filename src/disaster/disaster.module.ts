import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BranchModule } from '../branch/branch.module';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { controllers } from './controllers';
import { entities } from './entities';
import { DisasterAdminGuard } from './guards/disaster-admin.guard';
import { services } from './services';

@Module({
  imports: [
    TypeOrmModule.forFeature([...entities, User]),
    BranchModule,
    UserModule,
  ],
  controllers: [...controllers],
  providers: [...services, DisasterAdminGuard],
  exports: [...services],
})
export class DisasterModule {}
