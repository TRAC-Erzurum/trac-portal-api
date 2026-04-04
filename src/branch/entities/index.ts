import { Branch } from './branch.entity';
import { BranchCallSign } from './branch-call-sign.entity';
import { UserBranchMembership } from './user-branch-membership.entity';
import { OperatorBranchPreMembership } from './operator-branch-pre-membership.entity';

export const entities = [
  Branch,
  BranchCallSign,
  UserBranchMembership,
  OperatorBranchPreMembership,
];
