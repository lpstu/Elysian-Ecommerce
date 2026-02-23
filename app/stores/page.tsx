import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function StoresPage() {
  const supabase = await createClient();
  const { data: stores } = await supabase
    .from("profiles")
    .select("id,store_name,bio,avatar_url,role,store_verified")
    .in("role", ["seller", "admin"])
    .not("store_name", "is", null)
    .order("store_name");
  const normalizedStores = (stores ?? []).reduce<Array<{
    id: string;
    store_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    role: "buyer" | "seller" | "admin";
    store_verified?: boolean;
  }>>((acc, store) => {
    if (store.role === "admin") {
      if (!acc.some((item) => item.role === "admin")) {
        acc.push({ ...store, store_name: "Elysian Store", store_verified: true });
      }
      return acc;
    }
    acc.push(store);
    return acc;
  }, []);

  return (
    <section className="grid">
      <div className="section-head">
        <h1>Stores</h1>
        <p className="help">Open a store to view all available items.</p>
      </div>
      <div className="grid products">
        {normalizedStores?.map((store) => (
          <article key={store.id} className="card">
            {store.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.avatar_url} alt={store.store_name ?? "Store"} className="product-image" />
            ) : null}
            <h3>{store.store_name ?? (store.role === "admin" ? "Elysian Store" : "Seller Store")}</h3>
            <p className="muted">
              {store.role === "admin" ? "Admin managed store" : "Seller managed store"}{" "}
              {store.role === "admin" ? (
                <span className="verified-badge">Official</span>
              ) : store.store_verified ? (
                <span className="verified-badge">Verified</span>
              ) : null}
            </p>
            <p>{(store.bio ?? "No description yet.").slice(0, 120)}</p>
            <Link href={`/stores/${store.id}`} className="btn primary">
              Visit Store
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
