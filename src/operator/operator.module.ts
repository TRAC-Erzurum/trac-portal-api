import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { services } from './services';
import { OperatorService } from './services/operator.service';
import { controllers } from './controllers';

@Module({
  imports: [TypeOrmModule.forFeature([Operator])],
  controllers: [...controllers],
  providers: [...services],
  exports: [OperatorService],
})
export class OperatorModule {}
