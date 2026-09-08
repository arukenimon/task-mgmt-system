export const hasSupabaseConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured. Add the local or hosted values to .env.local.");
  }

  return { url, key };
}

export function getSiteUrl() {
  let url = process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.NEXT_PUBLIC_VERCEL_URL
    ?? "http://localhost:3000";

  if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}
