import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestSellerPayment, reviewSellerApplication } from "@/app/server-actions";

export default async function AdminSellersPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/admin/login?notAdmin=1");

  const { data: applications } = await supabase
    .from("seller_applications")
    .select("id,user_id,store_name,business_description,contact_phone,business_image_url,status,application_fee_payment_state,created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="grid">
      <div className="section-head">
        <h1>Seller Approval Queue</h1>
        <p className="help">Review business descriptions before approving marketplace access.</p>
      </div>
      {applications?.map((app) => (
        <article key={app.id} className="card">
          <h3>{app.store_name}</h3>
          <p>{app.business_description}</p>
          <p className="muted">Contact: {app.contact_phone ?? "No phone"}</p>
          {app.business_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.business_image_url} alt={app.store_name} className="product-image" />
          ) : null}
          <p>
            <strong>Status:</strong> {app.status}
          </p>
          <p>
            <strong>Fee payment:</strong> {app.application_fee_payment_state}
          </p>
          {app.status === "pending" ? (
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <form action={reviewSellerApplication}>
                <input type="hidden" name="applicationId" value={app.id} />
                <input type="hidden" name="userId" value={app.user_id} />
                <input type="hidden" name="action" value="approve" />
                <button className="btn primary" type="submit">
                  Approve
                </button>
              </form>
              <form action={reviewSellerApplication}>
                <input type="hidden" name="applicationId" value={app.id} />
                <input type="hidden" name="userId" value={app.user_id} />
                <input type="hidden" name="action" value="reject" />
                <button className="btn danger" type="submit">
                  Reject
                </button>
              </form>
              {app.application_fee_payment_state !== "paid" ? (
                <form action={requestSellerPayment}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="userId" value={app.user_id} />
                  <button className="btn light" type="submit">
                    Request Payment First
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
