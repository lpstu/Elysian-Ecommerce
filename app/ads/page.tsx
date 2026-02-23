import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdCampaign } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

type AdsPageProps = {
  searchParams: Promise<{ paid?: string; cancelled?: string; onlyBuyers?: string }>;
};

export default async function AdsPage({ searchParams }: AdsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const [{ data: profile }, { data: ads }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("ad_campaigns")
      .select("id,title,budget,payment_state,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  if (profile?.role !== "buyer") {
    return (
      <section className="card">
        <h2>Buyer Ads</h2>
        <p className="help">Only buyer accounts can create ad campaigns for now.</p>
      </section>
    );
  }

  return (
    <section className="grid">
      <div className="section-head">
        <h1>My Ads</h1>
        <p className="help">
          Create an ad campaign for your product or offer. Admin reviews campaigns after payment.
        </p>
      </div>
      {params.paid ? <p className="help">Payment successful. Your ad is now pending admin review.</p> : null}
      {params.cancelled ? <p className="help">Payment cancelled. You can retry anytime.</p> : null}
      {params.onlyBuyers ? <p className="help">Only buyers can create ads.</p> : null}

      <article className="card">
        <h2>Create Ad Campaign</h2>
        <form action={createAdCampaign}>
          <input name="title" placeholder="Ad title" required />
          <textarea name="description" rows={3} placeholder="Ad description" required />
          <input name="targetUrl" placeholder="Target URL (product/store link)" required />
          <input name="imageUrl" placeholder="Image URL (optional)" />
          <input type="number" name="budget" min={1000} step={500} placeholder="Budget in FCFA" required />
          <select name="paymentMethod" defaultValue="stripe">
            <option value="stripe">Stripe (Card)</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
          <button className="btn primary" type="submit">
            Create and Pay
          </button>
        </form>
      </article>

      <article className="card">
        <h2>My Campaigns</h2>
        <div className="grid">
          {ads?.map((ad) => (
            <div key={ad.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{ad.title}</strong></p>
              <p className="muted">Budget: {formatFcfa(ad.budget)}</p>
              <p className="muted">Payment: {ad.payment_state}</p>
              <p className="muted">Status: {ad.status}</p>
              <p className="help">{new Date(ad.created_at).toLocaleString()}</p>
            </div>
          ))}
          {!ads?.length ? <p className="help">No ad campaigns yet.</p> : null}
        </div>
      </article>
    </section>
  );
}
