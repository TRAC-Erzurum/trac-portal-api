import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';
import { services } from './services';
import { controllers } from './controllers';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([...entities, User])],
  controllers: [...controllers],
  providers: [...services],
  exports: [...services],
})
export class BranchModule {}
