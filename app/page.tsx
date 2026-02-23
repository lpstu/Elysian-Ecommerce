import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addToWishlist, createConversation } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

type HomeProps = {
  searchParams: Promise<{ category?: string; q?: string; store?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: categories }, { data: stores }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase
      .from("profiles")
      .select("id,store_name,role,store_verified")
      .in("role", ["seller", "admin"])
      .order("store_name")
  ]);

  let query = supabase
    .from("products")
    .select(
      "id,title,description,price,stock,image_url,seller_id,categories(name),profiles!products_seller_id_fkey(id,role,store_name,store_verified)"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (params.category) query = query.eq("category_id", params.category);
  if (params.q) query = query.ilike("title", `%${params.q}%`);
  if (params.store) query = query.eq("seller_id", params.store);

  const { data: products } = await query;
  const uniqueStores = (stores ?? []).reduce<Array<{ id: string; store_name: string | null; role: string; store_verified?: boolean }>>(
    (acc, store) => {
      if (!store.store_name) return acc;
      if (store.role === "admin") {
        const already = acc.find((item) => item.role === "admin");
        if (!already) acc.push({ id: store.id, store_name: "Elysian Store", role: "admin", store_verified: true });
        return acc;
      }
      acc.push({ id: store.id, store_name: store.store_name, role: store.role, store_verified: store.store_verified ?? false });
      return acc;
    },
    []
  );
  const featuredProducts = (products ?? [])
    .filter((product) => {
      const storeRef = (product as Record<string, unknown>).profiles as
        | { role?: string }
        | Array<{ role?: string }>
        | undefined;
      const role = Array.isArray(storeRef) ? storeRef[0]?.role : storeRef?.role;
      return role === "admin";
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 6);
  const marketplaceProducts = (products ?? []).filter((product) => {
    const storeRef = (product as Record<string, unknown>).profiles as
      | { role?: string }
      | Array<{ role?: string }>
      | undefined;
    const role = Array.isArray(storeRef) ? storeRef[0]?.role : storeRef?.role;
    return role !== "admin";
  });

  return (
    <section className="grid" style={{ gap: "1.2rem" }}>
      <div className="card hero">
        <span className="pill">Marketplace</span>
        <h1>Discover products from verified sellers</h1>
        <p className="help">
          Browse publicly by store/category. Login is required only when adding wishlist items or placing orders.
        </p>
      </div>
      <div className="card">
        <div className="section-head">
          <h2>Find the right product fast</h2>
          <p className="help">Use search, category, or store filters. You can also browse stores directly.</p>
        </div>
        <form>
          <input name="q" placeholder="Search products" defaultValue={params.q ?? ""} />
          <select name="category" defaultValue={params.category ?? ""}>
            <option value="">All categories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="store" defaultValue={params.store ?? ""}>
            <option value="">All stores</option>
            {uniqueStores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.store_name}
              </option>
            ))}
          </select>
          <Link href="/stores" className="btn outline">
            Browse Stores
          </Link>
          <button className="btn light" type="submit">
            Filter
          </button>
        </form>
      </div>

      <div className="section-head">
        <h2>Elysian Store Featured Items</h2>
        <p className="help">Random featured items curated by admins. Prices shown in FCFA.</p>
      </div>
      <div className="grid products">
        {featuredProducts.map((product) => (
          <article key={product.id} className="card">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.title} className="product-image" />
            ) : null}
            <h3>{product.title}</h3>
            <p className="muted">
              Elysian Store <span className="verified-badge">Official</span>
            </p>
            <p>{product.description.slice(0, 90)}...</p>
            <p>
              <strong>{formatFcfa(product.price)}</strong>
            </p>
            <div className="grid">
              <Link className="btn primary" href={`/checkout?productId=${product.id}`}>
                Order Now
              </Link>
              {user ? (
                <>
                  <form action={addToWishlist}>
                    <input type="hidden" name="productId" value={product.id} />
                    <button className="btn light" type="submit">
                      Add to Wishlist
                    </button>
                  </form>
                  <form action={createConversation}>
                    <input type="hidden" name="sellerId" value={product.seller_id} />
                    <button className="btn outline" type="submit">
                      Chat Store Owner
                    </button>
                  </form>
                </>
              ) : (
                <Link className="btn light" href="/auth">
                  Login to add wishlist
                </Link>
              )}
            </div>
          </article>
        ))}
        {!featuredProducts.length ? (
          <article className="card">
            <p className="help">No featured items yet. Admins can add products from Admin Dashboard.</p>
          </article>
        ) : null}
      </div>

      <div className="section-head">
        <h2>Products from Seller Stores</h2>
        <p className="help">Open a store to explore all items from that seller.</p>
      </div>
      <div className="grid products">
        {marketplaceProducts.map((product) => (
          <article key={product.id} className="card">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.title} className="product-image" />
            ) : null}
            <h3>{product.title}</h3>
            {(() => {
              const categoryRef = (product as Record<string, unknown>).categories as
                | { name?: string }
                | Array<{ name?: string }>
                | undefined;
              const categoryName = Array.isArray(categoryRef)
                ? categoryRef[0]?.name
                : categoryRef?.name;
              return <p className="muted">{categoryName ?? "Uncategorized"}</p>;
            })()}
            <p>{product.description.slice(0, 90)}...</p>
            {(() => {
              const storeRef = (product as Record<string, unknown>).profiles as
                | { id?: string; store_name?: string; store_verified?: boolean }
                | Array<{ id?: string; store_name?: string; store_verified?: boolean }>
                | undefined;
              const store = Array.isArray(storeRef) ? storeRef[0] : storeRef;
              return (
                <p className="muted">
                  Store:{" "}
                  {store?.id ? (
                    <>
                      <Link href={`/stores/${store.id}`}>{store.store_name ?? "Seller Store"}</Link>{" "}
                      {store.store_verified ? (
                        <span className="verified-badge">Verified</span>
                      ) : null}
                    </>
                  ) : (
                    "Seller Store"
                  )}
                </p>
              );
            })()}
            <p>
              <strong>{formatFcfa(product.price)}</strong>
            </p>
            <p className="muted">Stock: {product.stock}</p>
            <div className="grid">
              <Link className="btn primary" href={`/checkout?productId=${product.id}`}>
                Buy Now
              </Link>
              {user ? (
                <>
                  <form action={addToWishlist}>
                    <input type="hidden" name="productId" value={product.id} />
                    <button className="btn primary" type="submit">
                      Add to Wishlist
                    </button>
                  </form>
                  <form action={createConversation}>
                    <input type="hidden" name="sellerId" value={product.seller_id} />
                    <button className="btn light" type="submit">
                      Chat Seller
                    </button>
                  </form>
                </>
              ) : (
                <Link className="btn light" href="/auth">
                  Login to interact
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
