"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import {
  clientIdSchema,
  createClientSchema,
  updateClientSchema,
} from "@/features/clients/models/client-management.schemas";
import {
  archiveManagedClient,
  createManagedClient,
  editManagedClient,
  restoreManagedClient,
} from "@/features/clients/services/client-management.service";

export type ClientActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

async function requireSeniorDirector() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Sign in to manage clients.");
  if (profile.role !== "senior_director") throw new Error("Only Senior Directors can manage clients.");
  return profile;
}

function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[] | undefined> } }): ClientActionState {
  return { status: "error", message: "Check the highlighted fields and try again.", fieldErrors: error.flatten().fieldErrors };
}

function actionFailure(error: unknown, fallback: string): ClientActionState {
  return { status: "error", message: error instanceof Error ? error.message : fallback };
}

function revalidateClientViews() {
  for (const path of ["/clients", "/", "/overview", "/list", "/calendar", "/kanban"]) revalidatePath(path);
}

export async function createClientAction(_state: ClientActionState, formData: FormData): Promise<ClientActionState> {
  try {
    await requireSeniorDirector();
    const parsed = createClientSchema.safeParse({ name: formData.get("name"), accountLeadId: formData.get("accountLeadId") });
    if (!parsed.success) return validationFailure(parsed.error);
    await createManagedClient(parsed.data);
    revalidateClientViews();
    return { status: "success", message: `${parsed.data.name} is ready for new work.` };
  } catch (error) {
    return actionFailure(error, "The client could not be created.");
  }
}

export async function updateClientAction(_state: ClientActionState, formData: FormData): Promise<ClientActionState> {
  try {
    await requireSeniorDirector();
    const parsed = updateClientSchema.safeParse({
      clientId: formData.get("clientId"),
      name: formData.get("name"),
      accountLeadId: formData.get("accountLeadId"),
    });
    if (!parsed.success) return validationFailure(parsed.error);
    await editManagedClient(parsed.data);
    revalidateClientViews();
    return { status: "success", message: "Client details saved." };
  } catch (error) {
    return actionFailure(error, "The client could not be updated.");
  }
}

export async function archiveClientAction(_state: ClientActionState, formData: FormData): Promise<ClientActionState> {
  try {
    await requireSeniorDirector();
    const parsed = clientIdSchema.safeParse({ clientId: formData.get("clientId") });
    if (!parsed.success) return validationFailure(parsed.error);
    await archiveManagedClient(parsed.data);
    revalidateClientViews();
    return { status: "success", message: "Client archived. Historical tasks remain available." };
  } catch (error) {
    return actionFailure(error, "The client could not be archived.");
  }
}

export async function restoreClientAction(_state: ClientActionState, formData: FormData): Promise<ClientActionState> {
  try {
    await requireSeniorDirector();
    const parsed = clientIdSchema.safeParse({ clientId: formData.get("clientId") });
    if (!parsed.success) return validationFailure(parsed.error);
    await restoreManagedClient(parsed.data);
    revalidateClientViews();
    return { status: "success", message: "Client restored and available for new work." };
  } catch (error) {
    return actionFailure(error, "The client could not be restored.");
  }
}
