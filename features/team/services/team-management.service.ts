import "server-only";

import type { CreateTeamInput, DeactivateMemberInput, InviteMemberInput, UpdateMemberInput } from "@/features/team/models/team-management.schemas";
import {
  banMemberAuthUser,
  countOpenTasksForMember,
  getManagedMember,
  insertTeam,
  inviteMember,
  setMemberActive,
  updateMemberAssignment,
} from "@/features/team/repositories/team-management.repository";

function initialsFor(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function createTeam(input: CreateTeamInput) {
  return insertTeam(input.name);
}

export async function inviteTeamMember(input: InviteMemberInput) {
  return inviteMember(input, initialsFor(input.fullName));
}

export async function updateTeamMember(actorId: string, input: UpdateMemberInput) {
  if (actorId === input.memberId) throw new Error("You cannot change your own role from Team management.");

  const member = await getManagedMember(input.memberId);
  if (!member.isActive) throw new Error("A deactivated member cannot be edited.");

  const isChangingOwnershipContext = member.role === "team_member"
    && (input.role !== "team_member" || member.teamId !== input.teamId);

  if (isChangingOwnershipContext && await countOpenTasksForMember(input.memberId) > 0) {
    throw new Error("Complete or reassign this member's open tasks before changing their role or team.");
  }

  await updateMemberAssignment(input);
}

export async function deactivateTeamMember(actorId: string, input: DeactivateMemberInput) {
  if (actorId === input.memberId) throw new Error("You cannot deactivate your own account.");

  const member = await getManagedMember(input.memberId);
  if (!member.isActive) return;

  await setMemberActive(input.memberId, false);
  try {
    await banMemberAuthUser(input.memberId);
  } catch (error) {
    await setMemberActive(input.memberId, true);
    throw error;
  }
}

