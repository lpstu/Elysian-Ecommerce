import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminAccount,
  createAdminStoreProduct,
  deleteAdminStoreProduct,
  requestSellerPayment,
  reviewSellerApplication,
  reviewAdCampaign,
  sendPlatformNotification,
  updateOrderStatus,
  updateAdminStoreProduct,
  updateUserRole
} from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

type AdminDashboardProps = {
  searchParams: Promise<{ created?: string; noticeSent?: string }>;
};

export default async function AdminDashboardPage({ searchParams }: AdminDashboardProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/admin/login?notAdmin=1");

  const [{ data: adminProfiles }, { count: usersCount }, { count: sellersCount }, { count: pendingApps }, { count: productsCount }, { data: users }, { data: recentOrders }, { data: categories }, { data: adCampaigns }, { data: pendingSellerApps }] =
    await Promise.all([
      supabase.from("profiles").select("id").eq("role", "admin"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "seller"),
      supabase.from("seller_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("id,full_name,phone,role,avatar_url").order("created_at", { ascending: false }).limit(20),
      supabase
        .from("orders")
        .select("id,status,total_amount,payment_method,created_at,confirmed_at,shipped_at,delivered_at,cancelled_at")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("categories").select("id,name").order("name"),
      supabase
        .from("ad_campaigns")
        .select("id,user_id,title,budget,payment_state,status,created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("seller_applications")
        .select("id,user_id,store_name,application_fee_payment_state,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20)
    ]);
  const adminIds = (adminProfiles ?? []).map((a) => a.id);
  const [{ data: adminStoreProducts }, { data: adminStoreOrders }] = await Promise.all([
    supabase
      .from("products")
      .select("id,title,description,price,stock,image_url,category_id,categories(name),seller_id")
      .in("seller_id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id,status,total_amount,payment_method,created_at,confirmed_at,shipped_at,delivered_at,cancelled_at,buyer_id")
      .in("seller_id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <section className="grid">
      <div className="section-head">
        <h1>Admin Dashboard</h1>
        <p className="help">Manage users, create other admins, and monitor marketplace activity.</p>
      </div>

      <div className="grid products">
        <article className="card">
          <h3>Total users</h3>
          <p><strong>{usersCount ?? 0}</strong></p>
        </article>
        <article className="card">
          <h3>Total sellers</h3>
          <p><strong>{sellersCount ?? 0}</strong></p>
        </article>
        <article className="card">
          <h3>Pending seller requests</h3>
          <p><strong>{pendingApps ?? 0}</strong></p>
        </article>
        <article className="card">
          <h3>Published products</h3>
          <p><strong>{productsCount ?? 0}</strong></p>
        </article>
      </div>

      <article className="card">
        <h2>Create New Admin</h2>
        <p className="help">Admins are created here only. Public registration does not grant admin access.</p>
        {params.created ? <p className="help">New admin account created.</p> : null}
        <form action={createAdminAccount}>
          <input name="fullName" placeholder="Admin full name" required />
          <input type="email" name="email" placeholder="Admin email" required />
          <input type="password" name="password" placeholder="Temporary password (8+ chars)" required />
          <button className="btn primary" type="submit">Create Admin Account</button>
        </form>
      </article>

      <article className="card">
        <h2>Seller Approval Operations</h2>
        <p className="help">Approve, reject, or request payment before approving seller accounts.</p>
        <div className="grid">
          {pendingSellerApps?.map((app) => (
            <div key={app.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{app.store_name}</strong></p>
              <p className="muted">Status: {app.status}</p>
              <p className="muted">Fee payment: {app.application_fee_payment_state}</p>
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <form action={reviewSellerApplication}>
                  <input type="hidden" name="applicationId" value={app.id} />
                  <input type="hidden" name="userId" value={app.user_id} />
                  <input type="hidden" name="action" value="approve" />
                  <button className="btn primary" type="submit">
                    Approve Seller
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
                      Request Payment
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
          {!pendingSellerApps?.length ? (
            <p className="help">No pending seller applications right now.</p>
          ) : null}
        </div>
      </article>

      <article className="card">
        <h2>Platform Publicity Notifications</h2>
        <p className="help">
          Send announcements that appear in user profiles as notifications.
        </p>
        {params.noticeSent ? <p className="help">Notification sent successfully.</p> : null}
        <form action={sendPlatformNotification}>
          <input name="title" placeholder="Title (e.g. Weekend Sale)" required />
          <textarea name="body" rows={3} placeholder="Announcement message" required />
          <select name="targetRole" defaultValue="all">
            <option value="all">All users</option>
            <option value="buyers">Buyers only</option>
            <option value="sellers">Sellers only</option>
            <option value="admins">Admins only</option>
          </select>
          <button className="btn primary" type="submit">
            Send Notification
          </button>
        </form>
      </article>

      <article className="card">
        <h2>Ad Campaign Review</h2>
        <p className="help">Approve, reject, or waive payment for buyer ad campaigns.</p>
        <div className="grid">
          {adCampaigns?.map((ad) => (
            <div key={ad.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{ad.title}</strong></p>
              <p className="muted">Budget: {formatFcfa(ad.budget)}</p>
              <p className="muted">Payment: {ad.payment_state}</p>
              <p className="muted">Status: {ad.status}</p>
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <form action={reviewAdCampaign}>
                  <input type="hidden" name="adId" value={ad.id} />
                  <input type="hidden" name="action" value="approve" />
                  <button className="btn primary" type="submit">
                    Approve
                  </button>
                </form>
                <form action={reviewAdCampaign}>
                  <input type="hidden" name="adId" value={ad.id} />
                  <input type="hidden" name="action" value="reject" />
                  <button className="btn danger" type="submit">
                    Reject
                  </button>
                </form>
                {ad.payment_state !== "paid" ? (
                  <form action={reviewAdCampaign}>
                    <input type="hidden" name="adId" value={ad.id} />
                    <input type="hidden" name="action" value="waive_payment" />
                    <button className="btn light" type="submit">
                      Approve + Waive Payment
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2>Elysian Store Product Management</h2>
        <p className="help">
          These products are shown as featured on the homepage. Prices are managed in FCFA.
        </p>
        <form action={createAdminStoreProduct}>
          <input name="title" placeholder="Product title" required />
          <textarea name="description" placeholder="Description" rows={3} required />
          <input name="imageUrl" placeholder="Image URL" />
          <input type="number" name="price" placeholder="Price in FCFA" min={0} required />
          <input type="number" name="stock" placeholder="Stock" min={0} required />
          <select name="categoryId" required defaultValue="">
            <option value="" disabled>
              Select category
            </option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button className="btn primary" type="submit">
            Add Product to Elysian Store
          </button>
        </form>

        <div className="grid" style={{ marginTop: "0.8rem" }}>
          {adminStoreProducts?.map((product) => (
            <article key={product.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{product.title}</strong></p>
              <p className="muted">{formatFcfa(product.price)}</p>
              <p className="muted">Stock: {product.stock}</p>
              <form action={updateAdminStoreProduct}>
                <input type="hidden" name="productId" value={product.id} />
                <input name="title" defaultValue={product.title} required />
                <textarea name="description" rows={2} defaultValue={product.description} required />
                <input name="imageUrl" defaultValue={product.image_url ?? ""} />
                <input type="number" name="price" defaultValue={Number(product.price)} min={0} required />
                <input type="number" name="stock" defaultValue={product.stock} min={0} required />
                <select name="categoryId" defaultValue={product.category_id ?? ""} required>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button className="btn light" type="submit">
                  Update Product
                </button>
              </form>
              <form action={deleteAdminStoreProduct}>
                <input type="hidden" name="productId" value={product.id} />
                <button className="btn danger" type="submit">
                  Delete Product
                </button>
              </form>
            </article>
          ))}
        </div>
      </article>

      <article className="card">
        <h2>User Role Management</h2>
        <p className="help">Promote or demote users by role. Use admin role only for trusted staff.</p>
        <div className="grid">
          {users?.map((item) => (
            <div key={item.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{item.full_name ?? "Unnamed user"}</strong></p>
              <p className="muted">{item.phone ?? "No phone set"}</p>
              <p className="muted">Current role: {item.role}</p>
              <form action={updateUserRole} style={{ gridTemplateColumns: "1fr auto" }}>
                <input type="hidden" name="userId" value={item.id} />
                <select name="role" defaultValue={item.role}>
                  <option value="buyer">buyer</option>
                  <option value="seller">seller</option>
                  <option value="admin">admin</option>
                </select>
                <button className="btn light" type="submit">Update</button>
              </form>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2>Recent Orders</h2>
        <div className="grid">
          {recentOrders?.map((order) => (
            <div key={order.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{order.id}</strong></p>
              <p className="muted">
                Status: <span className={`status-badge ${order.status}`}>{order.status}</span>
              </p>
              <p className="muted">Payment: {order.payment_method}</p>
              <p className="muted">Total: {formatFcfa(order.total_amount)}</p>
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
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h2>Elysian Store Orders</h2>
        <p className="help">Orders placed on admin-managed products.</p>
        <div className="grid">
          {adminStoreOrders?.map((order) => (
            <div key={order.id} className="card" style={{ boxShadow: "none" }}>
              <p><strong>{order.id}</strong></p>
              <p className="muted">
                Status: <span className={`status-badge ${order.status}`}>{order.status}</span>
              </p>
              <p className="muted">Payment: {order.payment_method}</p>
              <p className="muted">Total: {formatFcfa(order.total_amount)}</p>
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
    </section>
  );
}
