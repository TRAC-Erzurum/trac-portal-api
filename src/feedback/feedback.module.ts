import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../shared/storage';
import { UserBranchMembership } from '../branch/entities/user-branch-membership.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [
    AuthModule,
    StorageModule,
    TypeOrmModule.forFeature([UserBranchMembership]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
