import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OperatorModule } from '../operator/operator.module';
import { StorageModule } from '../shared/storage';
import { OperatorBranchMembership } from '../branch/entities/operator-branch-membership.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [
    AuthModule,
    OperatorModule,
    StorageModule,
    TypeOrmModule.forFeature([OperatorBranchMembership]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
