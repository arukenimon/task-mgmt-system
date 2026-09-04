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
  members: ManagedMember[];
};

