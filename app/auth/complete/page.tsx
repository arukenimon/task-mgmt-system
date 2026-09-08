import { AuthFragmentComplete } from "@/features/identity/views/auth-fragment-complete";

type AuthCompletePageProps = {
  searchParams: Promise<{ reason?: string | string[] }>;
};

export default async function AuthCompletePage({ searchParams }: AuthCompletePageProps) {
  const params = await searchParams;
  const reason = params.reason === "recovery" ? "recovery" : "invite";
  return <AuthFragmentComplete reason={reason} />;
}
