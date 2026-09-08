import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { loadClientManagementData } from "@/features/clients/repositories/client-management.repository";
import { ClientManagement } from "@/features/clients/views/client-management";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export default async function ClientsPage() {
  if (!hasSupabaseConfig) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "senior_director") redirect("/overview");

  const data = await loadClientManagementData();
  return <ClientManagement actor={{ id: profile.id, name: profile.fullName, initials: profile.initials, role: profile.role, teamId: profile.teamId }} {...data} />;
}
