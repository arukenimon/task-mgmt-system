import "server-only";

import type { ClientIdInput, CreateClientInput, UpdateClientInput } from "@/features/clients/models/client-management.schemas";
import {
  getAvailableAccountLead,
  getManagedClient,
  insertManagedClient,
  setManagedClientActive,
  updateManagedClient,
} from "@/features/clients/repositories/client-management.repository";

async function validateAccountLead(accountLeadId: string | null) {
  if (accountLeadId) await getAvailableAccountLead(accountLeadId);
}

export async function createManagedClient(input: CreateClientInput) {
  await validateAccountLead(input.accountLeadId);
  return insertManagedClient(input);
}

export async function editManagedClient(input: UpdateClientInput) {
  await validateAccountLead(input.accountLeadId);
  return updateManagedClient(input);
}

export async function archiveManagedClient(input: ClientIdInput) {
  const client = await getManagedClient(input.clientId);
  if (!client.isActive) return;
  await setManagedClientActive(client.id, false);
}

export async function restoreManagedClient(input: ClientIdInput) {
  const client = await getManagedClient(input.clientId);
  if (client.isActive) return;
  await setManagedClientActive(client.id, true);
}
