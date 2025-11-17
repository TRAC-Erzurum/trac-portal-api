import { Mode } from '../../shared/enums/mode.enum';
import { NetType } from '../../shared/enums/net-type.enum';
export class CreateNetDto {
  name: string;
  frequency: string;
  mode: Mode;
  operatorId: string;
  type: NetType;
}
