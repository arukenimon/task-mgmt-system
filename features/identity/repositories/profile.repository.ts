import "server-only";

import type { Role } from "@/features/identity/models/roles";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  role: Role;
  teamId: string | null;
  fullName: string;
  email: string;
  initials: string;
  createdAt: string;
};

function isRole(value: string): value is Role {
  return value === "senior_director" || value === "account_director" || value === "team_member";
}

/**
 * Reads the signed-in identity from a verified Supabase access token, then loads
 * the server-authoritative role from the RLS-protected profile table.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || typeof userId !== "string") return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role,team_id,full_name,email,initials,created_at")
    .eq("id", userId)
    .single();

  if (error || !profile || !isRole(profile.role)) return null;

  return {
    id: profile.id,
    role: profile.role,
    teamId: profile.team_id,
    fullName: profile.full_name,
    email: profile.email,
    initials: profile.initials,
    createdAt: profile.created_at,
  };
}

export async function getProfileTeamName(teamId: string | null) {
  if (!teamId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("teams").select("name").eq("id", teamId).single();
  if (error || !data) throw new Error("Your team details could not be loaded.");
  return data.name;
}

export async function updateCurrentProfileName(fullName: string, initials: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_profile_name", {
    new_full_name: fullName,
    new_initials: initials,
  });

  if (error) throw new Error("Your profile name could not be updated.");
}
