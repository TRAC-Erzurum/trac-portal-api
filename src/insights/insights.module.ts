import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [DashboardModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
