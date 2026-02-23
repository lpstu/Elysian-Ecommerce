import { adminSignIn } from "@/app/server-actions";

type AdminLoginProps = {
  searchParams: Promise<{ notAdmin?: string; error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginProps) {
  const params = await searchParams;

  return (
    <section className="grid" style={{ maxWidth: 520, margin: "0 auto" }}>
      <article className="card hero">
        <span className="pill">Admin Access</span>
        <h1>Elysian Commerce Admin Portal</h1>
        <p className="help">This page is only for platform administrators. Admin registration is disabled.</p>
      </article>
      {params.notAdmin ? (
        <article className="card">
          <p className="help">This account is not an admin account.</p>
        </article>
      ) : null}
      {params.error ? (
        <article className="card">
          <p className="help">Invalid credentials. Please try again.</p>
        </article>
      ) : null}
      <article className="card">
        <form action={adminSignIn}>
          <input type="email" name="email" placeholder="Admin email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button className="btn primary" type="submit">
            Login to Admin Portal
          </button>
        </form>
      </article>
    </section>
  );
}
