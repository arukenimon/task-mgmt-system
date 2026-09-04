import "server-only";

import type { Role } from "@/features/identity/models/roles";
import type { TeamManagementData } from "@/features/team/models/team-management";
import type { InviteMemberInput, UpdateMemberInput } from "@/features/team/models/team-management.schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function assertRole(value: string): Role {
  if (value === "senior_director" || value === "account_director" || value === "team_member") return value;
  throw new Error("A profile contains an invalid role.");
}

export async function loadTeamManagementData(): Promise<TeamManagementData> {
  const supabase = await createClient();
  const [teamsResult, profilesResult, tasksResult] = await Promise.all([
    supabase.from("teams").select("id,name").order("name"),
    supabase.from("profiles").select("id,full_name,initials,email,role,team_id,is_active").order("full_name"),
    supabase.from("tasks").select("owner_id,status").neq("status", "complete"),
  ]);

  if (teamsResult.error || profilesResult.error || tasksResult.error) {
    throw new Error("Unable to load team management data.");
  }

  const openTasksByOwner = new Map<string, number>();
  for (const task of tasksResult.data ?? []) {
    openTasksByOwner.set(task.owner_id, (openTasksByOwner.get(task.owner_id) ?? 0) + 1);
  }

  return {
    teams: (teamsResult.data ?? []).map((team) => ({ id: team.id, name: team.name })),
    members: (profilesResult.data ?? []).map((profile) => ({
      id: profile.id,
      name: profile.full_name,
      initials: profile.initials,
      email: profile.email,
      role: assertRole(profile.role),
      teamId: profile.team_id,
      isActive: profile.is_active,
      openTaskCount: openTasksByOwner.get(profile.id) ?? 0,
    })),
  };
}

export async function insertTeam(name: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").insert({ name }).select("id,name").single();
  if (error?.code === "23505") throw new Error("A team with that name already exists.");
  if (error || !data) throw new Error("The team could not be created.");
  return data;
}

export async function inviteMember(input: InviteMemberInput, initials: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email);

  if (error?.message.toLowerCase().includes("already")) {
    throw new Error("An account with that email already exists.");
  }
  if (error || !data.user) throw new Error("The invitation email could not be sent.");

  const userId = data.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    full_name: input.fullName,
    email: input.email,
    initials,
    role: input.role,
    team_id: input.role === "senior_director" ? null : input.teamId,
    is_active: true,
  });

  if (!profileError) return userId;

  const { error: cleanupError } = await admin.auth.admin.deleteUser(userId);
  if (cleanupError) {
    throw new Error("The profile could not be created and the partial invitation needs administrator cleanup.");
  }
  if (profileError.code === "23505") throw new Error("An account with that email already exists.");
  throw new Error("The profile could not be created, so the invitation was cancelled.");
}

export async function getManagedMember(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,team_id,is_active")
    .eq("id", memberId)
    .single();

  if (error || !data) throw new Error("That member is no longer available.");
  return { id: data.id, role: assertRole(data.role), teamId: data.team_id, isActive: data.is_active };
}

export async function countOpenTasksForMember(memberId: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", memberId)
    .neq("status", "complete");
  if (error) throw new Error("The member's current workload could not be checked.");
  return count ?? 0;
}

export async function updateMemberAssignment(input: UpdateMemberInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      role: input.role,
      team_id: input.role === "senior_director" ? null : input.teamId,
    })
    .eq("id", input.memberId)
    .select("id")
    .single();
  if (error || !data) throw new Error("The member's role and team could not be updated.");
}

export async function setMemberActive(memberId: string, isActive: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", memberId).select("id").single();
  if (error || !data) throw new Error(isActive ? "The member could not be restored." : "The member could not be deactivated.");
}

export async function banMemberAuthUser(memberId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(memberId, { ban_duration: "876000h" });
  if (error) throw new Error("Supabase Auth could not deactivate this account.");
}
