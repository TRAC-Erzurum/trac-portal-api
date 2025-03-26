import { Mode } from '../../shared/enums/mode.enum';
import { SessionType } from '../../shared/enums/session-type.enum';
export class CreateSessionDto {
  name: string;
  frequency: string;
  mode: Mode;
  operatorId: string;
  type: SessionType;
}
