export interface ICurrentUser {
  id: string;
  email: string;
  provider: string;
  currentBranchId?: string;
}
