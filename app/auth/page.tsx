import { signIn, signUp } from "@/app/server-actions";
import GoogleSignInButton from "@/app/components/google-signin-button";

type AuthPageProps = {
  searchParams: Promise<{ checkEmail?: string; verifyRequired?: string }>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;

  return (
    <div className="grid" style={{ gap: "1rem" }}>
      <section className="card hero">
        <span className="pill">Secure Access</span>
        <h1>Welcome to Elysian Commerce</h1>
        <p className="help">
          Use your email/password or Google account. New accounts receive an email verification link.
        </p>
      </section>
      {params.checkEmail ? (
        <section className="card">
          <p className="help">
            Registration complete. Check your inbox and click the verification link before signing in.
          </p>
        </section>
      ) : null}
      {params.verifyRequired ? (
        <section className="card">
          <p className="help">
            Email verification is required. Please confirm your email, then sign in again.
          </p>
        </section>
      ) : null}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Login</h2>
        <p className="help">Tip: sellers and admins use the same login page.</p>
        <form action={signIn}>
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit" className="btn primary">
            Sign In
          </button>
          <GoogleSignInButton />
        </form>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Create account</h2>
        <p className="help">Public registration creates buyer accounts only. Admin accounts are created by existing admins.</p>
        <form action={signUp}>
          <input name="fullName" placeholder="Full name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password (8+ chars)" required />
          <button type="submit" className="btn primary">
            Register
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
