import { Role, GlobalRole } from '../../auth/enums/role.enum';

export interface ICurrentUser {
  id: string;
  email: string;
  role: Role;
  globalRole: GlobalRole;
  provider: string;
  currentBranchId?: string;
  operatorId?: string;
  callSign?: string;
}
