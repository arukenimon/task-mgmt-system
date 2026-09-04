"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import {
  createTeamSchema,
  deactivateMemberSchema,
  inviteMemberSchema,
  updateMemberSchema,
} from "@/features/team/models/team-management.schemas";
import {
  createTeam,
  deactivateTeamMember,
  inviteTeamMember,
  updateTeamMember,
} from "@/features/team/services/team-management.service";

export type TeamActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

async function requireSeniorDirector() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage the team.");
  if (profile.role !== "senior_director") throw new Error("Only Senior Directors can manage teams and access.");
  return profile;
}

function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): TeamActionState {
  return { status: "error", message: "Check the highlighted fields and try again.", fieldErrors: error.flatten().fieldErrors };
}

function actionFailure(error: unknown, fallback: string): TeamActionState {
  return { status: "error", message: error instanceof Error ? error.message : fallback };
}

function revalidateWorkspace() {
  revalidatePath("/team");
  revalidatePath("/overview");
  revalidatePath("/list");
  revalidatePath("/calendar");
  revalidatePath("/kanban");
}

export async function createTeamAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    await requireSeniorDirector();
    const parsed = createTeamSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) return validationFailure(parsed.error);
    await createTeam(parsed.data);
    revalidateWorkspace();
    return { status: "success", message: `${parsed.data.name} is ready for members.` };
  } catch (error) {
    return actionFailure(error, "The team could not be created.");
  }
}

export async function inviteMemberAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    await requireSeniorDirector();
    const parsed = inviteMemberSchema.safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      role: formData.get("role"),
      teamId: formData.get("teamId"),
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await inviteTeamMember(parsed.data);
    revalidateWorkspace();
    return { status: "success", message: `Invitation sent to ${parsed.data.email}.` };
  } catch (error) {
    return actionFailure(error, "The member could not be invited.");
  }
}

export async function updateMemberAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const actor = await requireSeniorDirector();
    const parsed = updateMemberSchema.safeParse({
      memberId: formData.get("memberId"),
      role: formData.get("role"),
      teamId: formData.get("teamId"),
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await updateTeamMember(actor.id, parsed.data);
    revalidateWorkspace();
    return { status: "success", message: "Role and team updated." };
  } catch (error) {
    return actionFailure(error, "The member could not be updated.");
  }
}

export async function deactivateMemberAction(_state: TeamActionState, formData: FormData): Promise<TeamActionState> {
  try {
    const actor = await requireSeniorDirector();
    const parsed = deactivateMemberSchema.safeParse({ memberId: formData.get("memberId") });
    if (!parsed.success) return validationFailure(parsed.error);
    await deactivateTeamMember(actor.id, parsed.data);
    revalidateWorkspace();
    return { status: "success", message: "Access deactivated. Existing task history was preserved." };
  } catch (error) {
    return actionFailure(error, "The member could not be deactivated.");
  }
}

