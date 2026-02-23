import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { placeOrder } from "@/app/server-actions";
import { formatFcfa } from "@/lib/money";

type CheckoutProps = {
  searchParams: Promise<{ productId?: string }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  if (!params.productId) redirect("/");

  const { data: product } = await supabase
    .from("products")
    .select("id,title,description,price,image_url,stock")
    .eq("id", params.productId)
    .single();

  if (!product) redirect("/");

  return (
    <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>{product.title}</h2>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.title} className="product-image" />
        ) : null}
        <p>{product.description}</p>
        <p>
          <strong>{formatFcfa(product.price)}</strong>
        </p>
      </article>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>Checkout</h2>
        <p className="help">
          Fill shipping details carefully. You can pay by card, Orange/MTN mobile money, or cash on delivery.
        </p>
        <form action={placeOrder}>
          <input type="hidden" name="productId" value={product.id} />
          <label>
            Quantity
            <input type="number" name="quantity" defaultValue={1} min={1} max={product.stock} />
          </label>
          <label>
            Shipping Address
            <textarea name="shippingAddress" required rows={4} />
          </label>
          <label>
            Payment Method
            <select name="paymentMethod" defaultValue="stripe">
              <option value="stripe">Stripe (Card)</option>
              <option value="mobile_money">Orange / MTN Mobile Money</option>
              <option value="cash_on_delivery">Cash on Delivery</option>
            </select>
          </label>
          <p className="muted">
            Mobile money orders are created and marked pending. Connect Flutterwave API keys for live Orange/MTN collections.
          </p>
          <button className="btn primary" type="submit">
            Place Order
          </button>
        </form>
      </article>
    </section>
  );
}
