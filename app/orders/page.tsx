import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createReview } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

export default async function OrdersPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: orders } = await supabase
    .from("orders")
    .select("id,status,payment_method,total_amount,created_at,confirmed_at,shipped_at,delivered_at,cancelled_at,seller_id,order_items(id,product_id,quantity,unit_price,products(title))")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <section className="grid">
      <div className="section-head">
        <h1>My Orders</h1>
        <p className="help">Track each order status and leave a review after purchase.</p>
      </div>
      {orders?.length ? (
        orders.map((order) => (
          <article className="card" key={order.id}>
            <p>
              <strong>Order:</strong> {order.id}
            </p>
            <p>
              <strong>Status:</strong> <span className={`status-badge ${order.status}`}>{order.status}</span>
            </p>
            <p>
              <strong>Payment:</strong> {order.payment_method}
            </p>
            <p>
              <strong>Total:</strong> {formatFcfa(order.total_amount)}
            </p>
            <div className="timeline">
              <p className="help">Placed: {new Date(order.created_at).toLocaleString()}</p>
              {order.confirmed_at ? (
                <p className="help">Confirmed: {new Date(order.confirmed_at).toLocaleString()}</p>
              ) : null}
              {order.shipped_at ? (
                <p className="help">Shipped: {new Date(order.shipped_at).toLocaleString()}</p>
              ) : null}
              {order.delivered_at ? (
                <p className="help">Delivered: {new Date(order.delivered_at).toLocaleString()}</p>
              ) : null}
              {order.cancelled_at ? (
                <p className="help">Cancelled: {new Date(order.cancelled_at).toLocaleString()}</p>
              ) : null}
            </div>
            {order.order_items?.map((item) => (
              <div key={item.id} className="card" style={{ marginTop: 8 }}>
                {(() => {
                  const productRef = (item as Record<string, unknown>).products as
                    | { title?: string }
                    | Array<{ title?: string }>
                    | undefined;
                  const title = Array.isArray(productRef)
                    ? productRef[0]?.title
                    : productRef?.title;
                  return (
                    <p>
                      {title ?? "Product"} x {item.quantity}
                    </p>
                  );
                })()}
                <form action={createReview}>
                  <input type="hidden" name="orderItemId" value={item.id} />
                  <input type="hidden" name="productId" value={item.product_id} />
                  <select name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option value={n} key={n}>
                        {n} Star
                      </option>
                    ))}
                  </select>
                  <textarea name="comment" rows={2} placeholder="Write review" />
                  <button className="btn light" type="submit">
                    Submit Review
                  </button>
                </form>
              </div>
            ))}
          </article>
        ))
      ) : (
        <p className="muted">No orders yet.</p>
      )}
    </section>
  );
}
