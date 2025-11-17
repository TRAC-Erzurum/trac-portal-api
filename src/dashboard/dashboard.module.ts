import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { Net } from '../net/entities/net.entity';
import { Attendee } from '../net/entities/attendee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Net, Attendee])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
