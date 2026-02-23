"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    setLoading(false);
  }

  return (
    <button
      type="button"
      className="btn outline"
      onClick={handleGoogleSignIn}
      disabled={loading}
    >
      {loading ? "Redirecting..." : "Continue with Google"}
    </button>
  );
}
