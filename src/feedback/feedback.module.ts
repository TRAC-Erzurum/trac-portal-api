import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../shared/storage';
import { FeedbackAdminController } from './feedback-admin.controller';
import { FeedbackGithubService } from './feedback-github.service';
import { FeedbackSyncService } from './feedback-sync.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { Feedback } from './entities/feedback.entity';

@Module({
  imports: [AuthModule, StorageModule, TypeOrmModule.forFeature([Feedback])],
  controllers: [FeedbackController, FeedbackAdminController],
  providers: [FeedbackService, FeedbackGithubService, FeedbackSyncService],
})
export class FeedbackModule {}
