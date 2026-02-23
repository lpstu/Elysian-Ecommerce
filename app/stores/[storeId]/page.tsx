import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addToWishlist, createConversation } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

type StorePageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function StorePage({ params }: StorePageProps) {
  const { storeId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: store }, { data: products }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,store_name,avatar_url,bio,phone,role,store_verified")
      .eq("id", storeId)
      .single(),
    supabase
      .from("products")
      .select("id,title,description,price,stock,image_url,seller_id,categories(name)")
      .eq("seller_id", storeId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
  ]);

  if (!store || (store.role !== "seller" && store.role !== "admin")) redirect("/stores");

  return (
    <section className="grid">
      <article className="card hero">
        <span className="pill">{store.role === "admin" ? "Elysian Store" : "Seller Store"}</span>
        <h1>{store.store_name ?? "Store"}</h1>
        <p className="help">
          {store.role === "admin" ? (
            <span className="verified-badge">Official</span>
          ) : store.store_verified ? (
            <span className="verified-badge">Admin Verified</span>
          ) : null}
        </p>
        <p className="help">{store.bio ?? "No description available."}</p>
        {store.phone ? <p className="help">Contact: {store.phone}</p> : null}
        {user ? (
          <form action={createConversation} style={{ maxWidth: 260 }}>
            <input type="hidden" name="sellerId" value={store.id} />
            <button className="btn outline" type="submit">
              Chat Store Owner
            </button>
          </form>
        ) : (
          <Link href="/auth" className="btn outline" style={{ maxWidth: 280 }}>
            Login to chat with store owner
          </Link>
        )}
      </article>

      <div className="grid products">
        {products?.map((product) => (
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
            <p>{product.description.slice(0, 110)}...</p>
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
                      Chat Store
                    </button>
                  </form>
                </>
              ) : (
                <Link className="btn light" href="/auth">
                  Login to wishlist or chat
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
