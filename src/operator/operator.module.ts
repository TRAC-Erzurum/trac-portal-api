import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from './entities/operator.entity';
import { Attendee } from '../net/entities/attendee.entity';
import { Net } from '../net/entities/net.entity';
import { services } from './services';
import { OperatorService } from './services/operator.service';
import { controllers } from './controllers';

@Module({
  imports: [TypeOrmModule.forFeature([Operator, Attendee, Net])],
  controllers: [...controllers],
  providers: [...services],
  exports: [OperatorService],
})
export class OperatorModule {}
