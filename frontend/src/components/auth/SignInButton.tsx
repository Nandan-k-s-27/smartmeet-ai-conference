"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInButton({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      className="btn-primary auth-google-button"
      disabled={isLoading}
      onClick={() => {
        setIsLoading(true);
        void signIn("google", { callbackUrl });
      }}
    >
      <i className="fab fa-google" aria-hidden="true"></i>
      {isLoading ? "Redirecting..." : "Continue with Google"}
    </button>
  );
}
