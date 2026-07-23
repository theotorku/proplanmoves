export const roleCodes = [
  "owner",
  "admin",
  "estimator",
  "dispatcher",
  "viewer"
] as const;

export type RoleCode = (typeof roleCodes)[number];

const roleRank: Record<RoleCode, number> = {
  owner: 50,
  admin: 40,
  estimator: 30,
  dispatcher: 20,
  viewer: 10
};

export function isRoleCode(value: string): value is RoleCode {
  return roleCodes.includes(value as RoleCode);
}

export function hasAnyRole(
  actualRoles: readonly RoleCode[],
  allowedRoles: readonly RoleCode[]
) {
  return actualRoles.some((role) => allowedRoles.includes(role));
}

export function hasRoleAtLeast(
  actualRoles: readonly RoleCode[],
  minimumRole: RoleCode
) {
  return actualRoles.some((role) => roleRank[role] >= roleRank[minimumRole]);
}
