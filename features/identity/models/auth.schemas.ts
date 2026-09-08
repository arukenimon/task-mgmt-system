import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid work email address.");

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    error: "Passwords do not match.",
    path: ["confirmation"],
  });
