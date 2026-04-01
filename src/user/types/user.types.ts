import { type EffectiveRole, GlobalRole } from '../../auth/enums/role.enum';

export interface ICurrentUser {
  id: string;
  email: string;
  role: EffectiveRole;
  globalRole: GlobalRole;
  provider: string;
  currentBranchId?: string;
  operatorId?: string;
  callSign?: string;
}
