import "server-only";

import type { Role } from "@/features/identity/models/roles";
import type { AccountLead, ClientManagementData, ManagedClient } from "@/features/clients/models/client-management";
import type { CreateClientInput, UpdateClientInput } from "@/features/clients/models/client-management.schemas";
import { createClient } from "@/lib/supabase/server";

function isRole(value: string): value is Role {
  return value === "senior_director" || value === "account_director" || value === "team_member";
}

export async function loadClientManagementData(): Promise<ClientManagementData> {
  const supabase = await createClient();
  const [clientsResult, profilesResult] = await Promise.all([
    supabase.from("clients").select("id,name,account_lead_id,is_active").order("is_active", { ascending: false }).order("name"),
    supabase.from("profiles").select("id,full_name,initials,role,is_active").order("full_name"),
  ]);

  if (clientsResult.error || profilesResult.error) throw new Error("Unable to load client management data.");

  const profiles = (profilesResult.data ?? []).filter((profile) => isRole(profile.role));
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
  const accountLeads: AccountLead[] = profiles
    .filter((profile) => profile.role === "account_director" && profile.is_active)
    .map((profile) => ({ id: profile.id, name: profile.full_name, initials: profile.initials }));
  const clients: ManagedClient[] = (clientsResult.data ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    accountLeadId: client.account_lead_id,
    accountLeadName: client.account_lead_id ? profileNames.get(client.account_lead_id) ?? "Former account lead" : null,
    isActive: client.is_active,
  }));

  return { clients, accountLeads };
}

export async function insertManagedClient(input: CreateClientInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: input.name, account_lead_id: input.accountLeadId })
    .select("id,name")
    .single();
  if (error?.code === "23505") throw new Error("A client with that name already exists.");
  if (error || !data) throw new Error("The client could not be created.");
  return data;
}

export async function updateManagedClient(input: UpdateClientInput) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ name: input.name, account_lead_id: input.accountLeadId })
    .eq("id", input.clientId)
    .select("id,name")
    .single();
  if (error?.code === "23505") throw new Error("A client with that name already exists.");
  if (error || !data) throw new Error("The client could not be updated.");
  return data;
}

export async function getManagedClient(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id,is_active").eq("id", clientId).single();
  if (error || !data) throw new Error("That client is no longer available.");
  return { id: data.id, isActive: data.is_active };
}

export async function setManagedClientActive(clientId: string, isActive: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").update({ is_active: isActive }).eq("id", clientId).select("id").single();
  if (error || !data) throw new Error(isActive ? "The client could not be restored." : "The client could not be archived.");
}

export async function getAvailableAccountLead(accountLeadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", accountLeadId)
    .single();
  if (error || !data || data.role !== "account_director" || !data.is_active) {
    throw new Error("Choose an active Account Director as the account lead.");
  }
  return data;
}
