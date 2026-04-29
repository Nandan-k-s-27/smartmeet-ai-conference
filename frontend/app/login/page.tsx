import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInButton } from "@/src/components/auth/SignInButton";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const params = searchParams ? await searchParams : {};
  const callbackUrl = params.callbackUrl?.startsWith("/") ? params.callbackUrl : "/dashboard";

  if (session?.user) {
    redirect(callbackUrl);
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <i className="fas fa-video" aria-hidden="true"></i>
          <h1>SmartMeet</h1>
          <p>Sign in to create meetings, join calls, and access AI summaries.</p>
        </div>

        {params.error ? (
          <div className="auth-error" role="alert">
            Authentication failed. Please try again.
          </div>
        ) : null}

        <SignInButton callbackUrl={callbackUrl} />
      </section>
    </main>
  );
}
