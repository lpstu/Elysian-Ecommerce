import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { removeFromWishlist } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

export default async function WishlistPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: items } = await supabase
    .from("wishlists")
    .select("product_id, products(id,title,price,image_url)")
    .eq("user_id", user.id);

  return (
    <section className="grid">
      <div className="section-head">
        <h1>Wishlist</h1>
        <p className="help">Keep products here to purchase later in one click.</p>
      </div>
      {items?.length ? (
        <div className="grid products">
          {items.map((item) => (
            <article className="card" key={item.product_id}>
              {(() => {
                const productRef = (item as Record<string, unknown>).products as
                  | { id?: string; title?: string; price?: number; image_url?: string }
                  | Array<{ id?: string; title?: string; price?: number; image_url?: string }>
                  | undefined;
                const product = Array.isArray(productRef) ? productRef[0] : productRef;
                return product?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.image_url} alt={product.title ?? "Product"} className="product-image" />
                ) : null;
              })()}
              {(() => {
                const productRef = (item as Record<string, unknown>).products as
                  | { title?: string; price?: number }
                  | Array<{ title?: string; price?: number }>
                  | undefined;
                const product = Array.isArray(productRef) ? productRef[0] : productRef;
                return (
                  <>
                    <h3>{product?.title ?? "Product"}</h3>
                    <p>{formatFcfa(product?.price ?? 0)}</p>
                  </>
                );
              })()}
              <Link className="btn light" href={`/checkout?productId=${item.product_id}`}>
                Buy
              </Link>
              <form action={removeFromWishlist}>
                <input type="hidden" name="productId" value={item.product_id} />
                <button className="btn danger" type="submit">
                  Remove
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No wishlist items yet.</p>
      )}
    </section>
  );
}
