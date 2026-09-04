"use server";

import { revalidatePath } from "next/cache";
import { updateProfileSchema } from "@/features/identity/models/profile.schemas";
import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { updateProfile } from "@/features/identity/services/profile.service";

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: { fullName?: string[] };
};

export async function updateProfileAction(
  _state: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return { status: "error", message: "Sign in to update your profile." };

    const parsed = updateProfileSchema.safeParse({ fullName: formData.get("fullName") });
    if (!parsed.success) {
      return {
        status: "error",
        message: "Check your name and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    await updateProfile(parsed.data);
    revalidatePath("/profile");
    revalidatePath("/overview");
    revalidatePath("/list");
    revalidatePath("/calendar");
    revalidatePath("/kanban");
    return { status: "success", message: "Your profile has been updated." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Your profile could not be updated.",
    };
  }
}
