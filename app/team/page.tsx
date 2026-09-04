import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { loadTeamManagementData } from "@/features/team/repositories/team-management.repository";
import { TeamManagement } from "@/features/team/views/team-management";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export default async function TeamPage() {
  if (!hasSupabaseConfig) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "senior_director") redirect("/overview");

  const data = await loadTeamManagementData();
  return (
    <TeamManagement
      actor={{ id: profile.id, name: profile.fullName, initials: profile.initials, role: profile.role }}
      members={data.members}
      teams={data.teams}
    />
  );
}
