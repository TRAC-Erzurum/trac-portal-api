import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { FeedbackGithubStatus } from '../enums/feedback-github-status.enum';
import { FEEDBACK_CATEGORIES, FeedbackCategory } from '../feedback.types';

export const MAX_FEEDBACK_LIST_LIMIT = 100;

export class ListFeedbackQueryDto {
  @IsOptional()
  @IsIn(FEEDBACK_CATEGORIES)
  category?: FeedbackCategory;

  @IsOptional()
  @IsEnum(FeedbackGithubStatus)
  githubStatus?: FeedbackGithubStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_FEEDBACK_LIST_LIMIT)
  limit: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset: number = 0;
}
