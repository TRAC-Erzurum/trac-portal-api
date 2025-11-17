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

  @Get('recent-nets')
  getRecentNets() {
    return this.dashboardService.getRecentNets();
  }

  @Get('top-stats')
  getTopStats(): Promise<any[]> {
    return this.dashboardService.getTopStats();
  }

  @Get('net-stats')
  getNetStats() {
    return this.dashboardService.getNetStats();
  }
}
