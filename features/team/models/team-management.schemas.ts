import { z } from "zod";

const roleSchema = z.enum(["senior_director", "account_director", "team_member"]);

const teamIdSchema = z.preprocess(
  (value) => typeof value === "string" && value.length > 0 ? value : null,
  z.string().uuid().nullable(),
);

function requireTeamForNonDirector(
  value: { role: z.infer<typeof roleSchema>; teamId: string | null },
  context: z.RefinementCtx,
) {
  if (value.role !== "senior_director" && !value.teamId) {
    context.addIssue({
      code: "custom",
      path: ["teamId"],
      message: "Choose a team for this role.",
    });
  }
}

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(80, "Keep the team name under 80 characters."),
});

export const inviteMemberSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the member's full name.").max(100, "Keep the name under 100 characters."),
  email: z.string().trim().toLowerCase().email("Enter a valid work email."),
  role: roleSchema,
  teamId: teamIdSchema,
}).superRefine(requireTeamForNonDirector);

export const updateMemberSchema = z.object({
  memberId: z.string().uuid(),
  role: roleSchema,
  teamId: teamIdSchema,
}).superRefine(requireTeamForNonDirector);

export const deactivateMemberSchema = z.object({
  memberId: z.string().uuid(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type DeactivateMemberInput = z.infer<typeof deactivateMemberSchema>;

