import { describe, expect, it } from "vitest";
import { setPasswordSchema } from "@/features/identity/models/auth.schemas";
import { createClientSchema, updateClientSchema } from "@/features/clients/models/client-management.schemas";
import { inviteMemberSchema, updateMemberSchema } from "@/features/team/models/team-management.schemas";

const ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("identity and team-management schemas", () => {
  it("requires a strong, matching password", () => {
    expect(setPasswordSchema.safeParse({
      password: "AValidPassword!2026",
      confirmation: "AValidPassword!2026",
    }).success).toBe(true);

    expect(setPasswordSchema.safeParse({
      password: "short",
      confirmation: "short",
    }).success).toBe(false);

    const mismatch = setPasswordSchema.safeParse({
      password: "AValidPassword!2026",
      confirmation: "AnotherPassword!2026",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.issues.some((issue) => issue.path.includes("confirmation"))).toBe(true);
    }
  });

  it("requires team membership for non-directors while preserving organisation-wide directors", () => {
    const missingTeam = inviteMemberSchema.safeParse({
      fullName: "Sam Taylor",
      email: "SAM.TAYLOR@AGENCY.CO.UK",
      role: "team_member",
      teamId: "",
    });
    expect(missingTeam.success).toBe(false);

    const director = inviteMemberSchema.parse({
      fullName: "Sam Taylor",
      email: "SAM.TAYLOR@AGENCY.CO.UK",
      role: "senior_director",
      teamId: "",
    });
    expect(director).toMatchObject({
      email: "sam.taylor@agency.co.uk",
      teamId: null,
    });

    expect(updateMemberSchema.safeParse({
      memberId: ID,
      role: "account_director",
      teamId: ID,
    }).success).toBe(true);
  });

  it("normalizes client details and accepts an optional account lead", () => {
    expect(createClientSchema.parse({ name: "  Atlas Automotive  ", accountLeadId: "" })).toEqual({
      name: "Atlas Automotive",
      accountLeadId: null,
    });

    expect(updateClientSchema.safeParse({
      clientId: ID,
      name: "Solstice Motors",
      accountLeadId: ID,
    }).success).toBe(true);
    expect(createClientSchema.safeParse({ name: " ", accountLeadId: ID }).success).toBe(false);
  });
});
