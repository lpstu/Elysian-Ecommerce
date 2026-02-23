import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProduct, updateOrderStatus } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

export default async function SellerDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") redirect("/admin/dashboard");
  if (profile?.role !== "seller") {
    return (
      <section className="card">
        <h2>Seller Access Needed</h2>
        <p>Apply as a seller and wait for admin approval first.</p>
        <Link className="btn light" href="/seller/apply">
          Go to Seller Application
        </Link>
      </section>
    );
  }

  const [{ data: categories }, { data: products }, { data: orders }, { data: conversations }] =
    await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id,status,total_amount,payment_method,created_at,confirmed_at,shipped_at,delivered_at,cancelled_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("conversations").select("id,buyer_id,created_at").eq("seller_id", user.id)
    ]);

  return (
    <section className="grid">
      <div className="section-head">
        <h1>Seller Dashboard</h1>
        <p className="help">Add products, monitor orders, and reply to buyers quickly.</p>
      </div>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Add Product</h2>
        <p className="help">Use a clear title, quality image URL, and accurate stock quantity.</p>
        <form action={createProduct}>
          <input name="title" placeholder="Product title" required />
          <textarea name="description" placeholder="Description" required rows={3} />
          <input type="number" name="price" min="0" step="0.01" placeholder="Price" required />
          <input type="number" name="stock" min="0" step="1" placeholder="Stock" required />
          <input name="imageUrl" placeholder="Image URL" />
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>
              Select category
            </option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button className="btn primary" type="submit">
            Publish Product
          </button>
        </form>
      </article>

      <article className="card">
        <h2 style={{ marginTop: 0 }}>My Products</h2>
        <p className="help">Published items appear immediately in marketplace results.</p>
        <div className="grid products">
          {products?.map((product) => (
            <div className="card" key={product.id}>
              <strong>{product.title}</strong>
              <p>{formatFcfa(product.price)}</p>
              <p className="muted">Stock: {product.stock}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2 style={{ marginTop: 0 }}>Incoming Orders</h2>
        <p className="help">Process paid orders first and confirm delivery to keep reviews strong.</p>
        <div className="grid">
          {orders?.map((order) => (
            <div key={order.id} className="card">
              <p>{order.id}</p>
              <p>
                Status: <span className={`status-badge ${order.status}`}>{order.status}</span>
              </p>
              <p>Payment: {order.payment_method}</p>
              <p>Total: {formatFcfa(order.total_amount)}</p>
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
              {order.status === "pending" || order.status === "paid" ? (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextStatus" value="processing" />
                  <button className="btn primary" type="submit">
                    Confirm Order
                  </button>
                </form>
              ) : null}
              {order.status === "processing" ? (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextStatus" value="shipped" />
                  <button className="btn light" type="submit">
                    Mark as Shipped
                  </button>
                </form>
              ) : null}
              {order.status === "shipped" ? (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextStatus" value="delivered" />
                  <button className="btn light" type="submit">
                    Mark as Delivered
                  </button>
                </form>
              ) : null}
              {order.status === "pending" ? (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="nextStatus" value="cancelled" />
                  <button className="btn danger" type="submit">
                    Cancel Order
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2 style={{ marginTop: 0 }}>Chats</h2>
        <p className="help">Open a chat to answer product questions or delivery requests.</p>
        <div className="grid">
          {conversations?.map((conversation) => (
            <Link key={conversation.id} className="btn light" href={`/chat/${conversation.id}`}>
              Open chat {conversation.id.slice(0, 8)}
            </Link>
          ))}
        </div>
      </article>
    </section>
  );
}
