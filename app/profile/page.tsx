import { redirect } from "next/navigation";
import { getCurrentProfile, getProfileTeamName } from "@/features/identity/repositories/profile.repository";
import { ProfileSettings } from "@/features/identity/views/profile-settings";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export default async function ProfilePage() {
  if (!hasSupabaseConfig) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const teamName = await getProfileTeamName(profile.teamId);

  return (
    <ProfileSettings
      profile={{
        fullName: profile.fullName,
        email: profile.email,
        initials: profile.initials,
        role: profile.role,
        teamName,
        createdAt: profile.createdAt,
      }}
    />
  );
}
