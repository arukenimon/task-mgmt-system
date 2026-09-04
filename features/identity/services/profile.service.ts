import "server-only";

import type { UpdateProfileInput } from "@/features/identity/models/profile.schemas";
import { updateCurrentProfileName } from "@/features/identity/repositories/profile.repository";

function initialsFor(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export async function updateProfile(input: UpdateProfileInput) {
  await updateCurrentProfileName(input.fullName, initialsFor(input.fullName));
}
