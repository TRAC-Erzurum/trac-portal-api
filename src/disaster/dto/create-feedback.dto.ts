import { IsEnum } from 'class-validator';
import { ObservationFeedbackType } from '../enums/observation-feedback-type.enum';

export class CreateFeedbackDto {
  @IsEnum(ObservationFeedbackType)
  type: ObservationFeedbackType;
}
