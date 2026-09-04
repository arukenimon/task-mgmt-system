export const ROLES = [
  "senior_director",
  "account_director",
  "team_member",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  senior_director: "Senior Director",
  account_director: "Account Director",
  team_member: "Team member",
};

export function canManageTeamWork(role: Role) {
  return role === "senior_director" || role === "account_director";
}
