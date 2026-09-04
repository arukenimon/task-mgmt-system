import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters.")
    .max(80, "Keep your name to 80 characters or fewer.")
    .regex(/\S+\s+\S+/, "Enter your first and last name."),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
