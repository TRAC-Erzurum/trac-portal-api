import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { CurrentUser } from '../../user/decorators/current-user.decorator';
import { User } from '../../user/entities/user.entity';
import {
  ActivityService,
  ActivityFeedItem,
} from '../services/activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('feed')
  async getFeed(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ActivityFeedItem[]> {
    return this.activityService.findRecentForUser(user.id, Math.min(limit, 50));
  }

  @Get('global')
  async getGlobalFeed(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<ActivityFeedItem[]> {
    return this.activityService.findRecentGlobal(Math.min(limit, 50));
  }
}
