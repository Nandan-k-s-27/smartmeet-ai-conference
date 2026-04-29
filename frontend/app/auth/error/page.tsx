import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <i className="fas fa-triangle-exclamation" aria-hidden="true"></i>
          <h1>Sign-in error</h1>
          <p>We could not complete authentication. Please try signing in again.</p>
        </div>
        <Link className="btn-primary auth-link" href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
