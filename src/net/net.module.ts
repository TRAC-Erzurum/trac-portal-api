import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorModule } from '../operator/operator.module';
import { controllers } from './controllers';
import { services } from './services';
import { entities } from './entities';
import { ManageNetGuard } from './guards/manage-net.guard';
import { UserModule } from '../user/user.module';
import { BranchModule } from '../branch/branch.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(entities),
    OperatorModule,
    UserModule,
    forwardRef(() => BranchModule),
  ],
  controllers: controllers,
  providers: [...services, ManageNetGuard],
  exports: [...services],
})
export class NetModule {}
