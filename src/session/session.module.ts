import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorModule } from '../operator/operator.module';
import { controllers } from './controllers';
import { services } from './services';
import { entities } from './entities';
import { ManageSessionGuard } from './guards/manage-session.guard';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature(entities), OperatorModule, UserModule],
  controllers: controllers,
  providers: [...services, ManageSessionGuard],
  exports: [...services],
})
export class SessionModule {}
