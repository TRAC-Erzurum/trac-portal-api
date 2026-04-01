/** Şube üyelik rolleri */
export enum BranchRole {
  PRESIDENT = 'president',
  ADMIN = 'admin',
  MEMBER = 'member',
  VOLUNTEER = 'volunteer',
}

/** Kullanıcı kök kaydı (portal geneli) */
export enum GlobalRole {
  GUEST = 'guest',
  SUPER_ADMIN = 'super_admin',
}

/** JWT / @Roles: şube rolü veya kök rol birleşimi */
export type EffectiveRole = GlobalRole | BranchRole;

const RANK: Record<EffectiveRole, number> = {
  [GlobalRole.SUPER_ADMIN]: 60,
  [BranchRole.PRESIDENT]: 50,
  [BranchRole.ADMIN]: 40,
  [BranchRole.MEMBER]: 30,
  [BranchRole.VOLUNTEER]: 20,
  [GlobalRole.GUEST]: 10,
};

export function effectiveRoleRank(role: EffectiveRole): number {
  return RANK[role] ?? 0;
}

/** Kullanıcının rolü, gereken minimum seviyeyi karşılıyor mu (üst seviye alt @Roles şartını geçer). */
export function effectiveRoleMeetsMinimum(
  userRole: EffectiveRole,
  required: EffectiveRole,
): boolean {
  return effectiveRoleRank(userRole) >= effectiveRoleRank(required);
}

/** Yönetici kademesi: şube başkanı / şube yöneticisi veya sistem yöneticisi */
export function isLeadershipOrSuperEffective(role: EffectiveRole): boolean {
  return (
    role === GlobalRole.SUPER_ADMIN ||
    role === BranchRole.PRESIDENT ||
    role === BranchRole.ADMIN
  );
}
