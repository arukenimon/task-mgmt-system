function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * A session created from an invite or recovery email is deliberately temporary.
 * The workspace accepts only sessions whose Supabase AMR records password auth.
 */
export function hasPasswordAuthentication(claims: unknown) {
  if (!isRecord(claims)) return false;
  const amr = claims.amr;
  if (!Array.isArray(amr)) return false;

  return amr.some(
    (entry: unknown) => isRecord(entry) && entry.method === "password",
  );
}
