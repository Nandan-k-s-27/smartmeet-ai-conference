"use client";

import { signOut, useSession } from "next-auth/react";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: session, status } = useSession();
  const user = session?.user;

  if (status === "loading") {
    return <div className={`auth-user-menu ${compact ? "compact" : ""}`.trim()}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  const label = user.name || user.email || "Signed in";

  return (
    <div className={`auth-user-menu ${compact ? "compact" : ""}`.trim()}>
      {user.image ? (
        <img className="auth-user-avatar" src={user.image} alt="" width={32} height={32} />
      ) : (
        <span className="auth-user-avatar fallback" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      {!compact ? (
        <div className="auth-user-copy">
          <span>{label}</span>
          <small>{user.role}</small>
        </div>
      ) : null}
      <button
        type="button"
        className="auth-signout-button"
        onClick={() => void signOut({ callbackUrl: "/login" })}
        aria-label="Sign out"
        title="Sign out"
      >
        <i className="fas fa-arrow-right-from-bracket" aria-hidden="true"></i>
      </button>
    </div>
  );
}
