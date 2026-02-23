import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyAsSeller } from "@/app/server-actions";

export default async function SellerApplyPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: application } = await supabase
    .from("seller_applications")
    .select("store_name,business_description,contact_phone,business_image_url,status,application_fee_payment_state")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") redirect("/admin/dashboard");
  if (profile?.role === "seller") redirect("/seller/dashboard");

  return (
    <section className="grid" style={{ maxWidth: 700 }}>
      <div className="section-head">
        <h1>Seller Registration</h1>
        <p className="help">
          Provide clear store details. Admin usually reviews applications in the seller queue.
        </p>
      </div>
      <article className="card">
        <p>
          <strong>Status:</strong> {application?.status ?? "not submitted"}
        </p>
        <p>
          <strong>Application fee:</strong> {application?.application_fee_payment_state ?? "unpaid"}
        </p>
        <p className="help">
          Seller application fee is 10,000 FCFA. Admin can still approve manually or request payment first.
        </p>
        <form action={applyAsSeller}>
          <input
            name="storeName"
            placeholder="Store name"
            defaultValue={application?.store_name ?? ""}
            required
          />
          <input
            name="contactPhone"
            placeholder="Business contact phone"
            defaultValue={application?.contact_phone ?? ""}
            required
          />
          <input
            name="businessImageUrl"
            placeholder="Business image URL (store front/logo)"
            defaultValue={application?.business_image_url ?? ""}
          />
          <textarea
            rows={5}
            name="businessDescription"
            placeholder="What will you sell?"
            defaultValue={application?.business_description ?? ""}
            required
          />
          {application?.business_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={application.business_image_url} alt="Business" className="product-image" />
          ) : null}
          <label>
            Pay application fee now?
            <select name="payNow" defaultValue="yes">
              <option value="yes">Yes, pay now</option>
              <option value="no">No, submit and pay later</option>
            </select>
          </label>
          <label>
            Payment method
            <select name="paymentMethod" defaultValue="stripe">
              <option value="stripe">Stripe (Card)</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </label>
          <button className="btn primary" type="submit">
            Submit For Admin Approval
          </button>
        </form>
      </article>
    </section>
  );
}
