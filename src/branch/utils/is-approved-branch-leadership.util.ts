import { BranchRole } from '../enums/branch-role.enum';
import { MembershipStatus } from '../enums/membership-status.enum';

/** Approved şube yöneticisi veya başkan (ManageNet, sertifika vb. paritesi). */
export function isApprovedBranchLeadership(
  membership: { status: MembershipStatus; role: BranchRole } | null | undefined,
): boolean {
  if (!membership || membership.status !== MembershipStatus.APPROVED) {
    return false;
  }
  return (
    membership.role === BranchRole.ADMIN ||
    membership.role === BranchRole.PRESIDENT
  );
}
