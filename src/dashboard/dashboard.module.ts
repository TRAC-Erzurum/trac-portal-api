import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { Session } from '../session/entities/session.entity';
import { Attendee } from '../session/entities/attendee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Attendee])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
