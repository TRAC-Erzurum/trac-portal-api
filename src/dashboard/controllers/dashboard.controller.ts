import { Controller, Get } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('personal-stats')
  getPersonalStats(@CurrentUser() user: User) {
    return this.dashboardService.getPersonalStats(user.id);
  }

  @Get('recent-sessions')
  getRecentSessions() {
    return this.dashboardService.getRecentSessions();
  }

  @Get('top-stats')
  getTopStats(): Promise<any[]> {
    return this.dashboardService.getTopStats();
  }

  @Get('session-stats')
  getSessionStats() {
    return this.dashboardService.getSessionStats();
  }
}
