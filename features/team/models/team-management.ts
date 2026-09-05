import type { Role } from "@/features/identity/models/roles";

export type ManagedTeam = {
  id: string;
  name: string;
};

export type ManagedMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  teamId: string | null;
  isActive: boolean;
  openTaskCount: number;
};

export type TeamManagementData = {
  teams: ManagedTeam[];
  initialMemberPage: ManagedMemberPage;
  activeMemberCount: number;
  inactiveMemberOpenTaskCount: number;
};

export const TEAM_MEMBER_PAGE_SIZE = 20;

export type ManagedMemberCursor = {
  name: string;
  id: string;
};

export type ManagedMemberPage = {
  members: ManagedMember[];
  nextCursor: ManagedMemberCursor | null;
  total: number;
};

export type ManagedMemberPageRequest = {
  query: string;
  cursor?: ManagedMemberCursor | null;
};
