import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { GlobalRole } from '../auth/enums/role.enum';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import { FeedbackGithubService } from './feedback-github.service';
import { FeedbackService } from './feedback.service';

/** Super-admin view of submitted feedback and its GitHub forwarding. */
@Controller('feedback')
@Roles(GlobalRole.SUPER_ADMIN)
export class FeedbackAdminController {
  constructor(
    private readonly feedbackService: FeedbackService,
    private readonly github: FeedbackGithubService,
  ) {}

  @Get()
  list(@Query() query: ListFeedbackQueryDto) {
    return this.feedbackService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.feedbackService.findOne(id);
  }

  @Post('forward-pending')
  async forwardPending() {
    if (!this.github.getConfig()) {
      throw new ServiceUnavailableException('error.feedbackNotConfigured');
    }
    const result = await this.github.forwardPendingBatch({ wait: true });
    return result ?? { processed: 0, sent: 0, failed: 0 };
  }

  @Post(':id/forward')
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.github.retryRecord(id);
  }
}
