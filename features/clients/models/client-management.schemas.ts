import { z } from "zod";

const databaseIdSchema = z.guid();
const accountLeadIdSchema = z.preprocess(
  (value) => typeof value === "string" && value.length > 0 ? value : null,
  databaseIdSchema.nullable(),
);

const clientNameSchema = z.string().trim().min(2, "Enter at least 2 characters.").max(120, "Keep the client name under 120 characters.");

export const createClientSchema = z.object({
  name: clientNameSchema,
  accountLeadId: accountLeadIdSchema,
});

export const updateClientSchema = z.object({
  clientId: databaseIdSchema,
  name: clientNameSchema,
  accountLeadId: accountLeadIdSchema,
});

export const clientIdSchema = z.object({
  clientId: databaseIdSchema,
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientIdInput = z.infer<typeof clientIdSchema>;
