import "server-only";

import type { Role } from "@/features/identity/models/roles";
import { TEAM_MEMBER_PAGE_SIZE, type ManagedMember, type ManagedMemberPage, type ManagedMemberPageRequest, type TeamManagementData } from "@/features/team/models/team-management";
import type { InviteMemberInput, UpdateMemberInput } from "@/features/team/models/team-management.schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function assertRole(value: string): Role {
  if (value === "senior_director" || value === "account_director" || value === "team_member") return value;
  throw new Error("A profile contains an invalid role.");
}

function escapeIlike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&").replace(/"/g, "\\\"");
}

function asManagedMember(profile: { id: string; full_name: string; initials: string; email: string; role: string; team_id: string | null; is_active: boolean }, openTaskCount: number): ManagedMember {
  return {
    id: profile.id,
    name: profile.full_name,
    initials: profile.initials,
    email: profile.email,
    role: assertRole(profile.role),
    teamId: profile.team_id,
    isActive: profile.is_active,
    openTaskCount,
  };
}

export async function loadManagedMemberPage({ query: searchQuery, cursor = null }: ManagedMemberPageRequest): Promise<ManagedMemberPage> {
  const supabase = await createClient();
  const search = searchQuery.trim();
  const matchingTeamsResult = search ? await supabase.from("teams").select("id").ilike("name", `%${escapeIlike(search)}%`) : null;
  if (matchingTeamsResult?.error) throw new Error("Unable to search teams.");
  const matchingTeamIds = matchingTeamsResult?.data?.map((team) => team.id) ?? [];
  let query = supabase.from("profiles").select("id,full_name,initials,email,role,team_id,is_active", { count: "exact" });

  const searchFilter = search
    ? [
      `full_name.ilike."%${escapeIlike(search)}%"`,
      `email.ilike."%${escapeIlike(search)}%"`,
      `role.ilike."%${escapeIlike(search.replace(/\s+/g, "_"))}%"`,
      ...matchingTeamIds.length ? [`team_id.in.(${matchingTeamIds.join(",")})`] : [],
    ].join(",")
    : null;
  const cursorFilter = cursor
    ? `full_name.gt."${escapeIlike(cursor.name)}",and(full_name.eq."${escapeIlike(cursor.name)}",id.gt.${cursor.id})`
    : null;
  if (searchFilter && cursorFilter) query = query.or(`and(or(${searchFilter}),or(${cursorFilter}))`);
  else if (searchFilter ?? cursorFilter) query = query.or(searchFilter ?? cursorFilter ?? "");

  const { data, error, count } = await query.order("full_name").order("id").limit(TEAM_MEMBER_PAGE_SIZE + 1);
  if (error) throw new Error("Unable to load the team directory.");

  const pageProfiles = (data ?? []).slice(0, TEAM_MEMBER_PAGE_SIZE);
  const ownerIds = pageProfiles.map((profile) => profile.id);
  const { data: openTasks, error: openTasksError } = ownerIds.length
    ? await supabase.from("tasks").select("owner_id").in("owner_id", ownerIds).neq("status", "complete")
    : { data: [], error: null };
  if (openTasksError) throw new Error("Unable to load team workloads.");

  const openTasksByOwner = new Map<string, number>();
  for (const task of openTasks ?? []) openTasksByOwner.set(task.owner_id, (openTasksByOwner.get(task.owner_id) ?? 0) + 1);
  const members = pageProfiles.map((profile) => asManagedMember(profile, openTasksByOwner.get(profile.id) ?? 0));
  const lastMember = members.at(-1);

  return {
    members,
    total: count ?? 0,
    nextCursor: (data?.length ?? 0) > TEAM_MEMBER_PAGE_SIZE && lastMember ? { name: lastMember.name, id: lastMember.id } : null,
  };
}

export async function loadTeamManagementData(): Promise<TeamManagementData> {
  const supabase = await createClient();
  const [teamsResult, activeMembersResult, inactiveWorkResult, initialMemberPage] = await Promise.all([
    supabase.from("teams").select("id,name").order("name"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("tasks").select("id,profiles!tasks_owner_id_fkey!inner(is_active)", { count: "exact", head: true }).eq("profiles.is_active", false).neq("status", "complete"),
    loadManagedMemberPage({ query: "" }),
  ]);

  if (teamsResult.error || activeMembersResult.error || inactiveWorkResult.error) {
    throw new Error("Unable to load team management data.");
  }

  return {
    teams: (teamsResult.data ?? []).map((team) => ({ id: team.id, name: team.name })),
    initialMemberPage,
    activeMemberCount: activeMembersResult.count ?? 0,
    inactiveMemberOpenTaskCount: inactiveWorkResult.count ?? 0,
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
