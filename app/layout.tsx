import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Space_Grotesk, Fraunces } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/server-actions";
import SplashScreen from "@/app/components/splash-screen";
import RouteLoader from "@/app/components/route-loader";
import PageTransition from "@/app/components/page-transition";
import NotificationBell from "@/app/components/notification-bell";

export const metadata: Metadata = {
  title: "Elysian Commerce",
  description: "Multi-vendor ecommerce platform"
};

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  let role: "buyer" | "seller" | "admin" | null = null;
  let unreadCount = 0;
  let recentNotifications: Array<{
    id: string;
    title: string;
    body: string;
    is_read: boolean;
    created_at: string;
  }> = [];
  if (user) {
    const [{ data: profile }, { count }, { data: notifications }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("*", { head: true, count: "exact" })
        .eq("user_id", user.id)
        .eq("is_read", false),
      supabase
        .from("notifications")
        .select("id,title,body,is_read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6)
    ]);
    role = (profile?.role as "buyer" | "seller" | "admin" | undefined) ?? "buyer";
    unreadCount = count ?? 0;
    recentNotifications = notifications ?? [];
  }

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
        <SplashScreen />
        <RouteLoader />
        <nav className="nav">
          <Link href="/" className="brand">
            <span className="brand-mark" />
            <strong>Elysian Commerce</strong>
          </Link>
          <div className="nav-links">
            <Link className="nav-link" href="/">
              Shop
            </Link>
            <Link className="nav-link" href="/stores">
              Stores
            </Link>
            {user ? (
              <>
                <Link className="nav-link" href="/wishlist">
                  Wishlist
                </Link>
                <Link className="nav-link" href="/orders">
                  Orders
                </Link>
                <Link className="nav-link" href="/profile">
                  Profile
                </Link>
              </>
            ) : null}
            {role === "buyer" ? (
              <>
                <Link className="nav-link" href="/seller/apply">
                  Become Seller
                </Link>
                <Link className="nav-link" href="/ads">
                  My Ads
                </Link>
              </>
            ) : null}
            {role === "seller" ? (
              <Link className="nav-link" href="/seller/dashboard">
                Seller Dashboard
              </Link>
            ) : null}
            {!user ? (
              <Link className="btn primary" href="/auth">
                Login
              </Link>
            ) : (
              <>
                <NotificationBell unreadCount={unreadCount} notifications={recentNotifications} />
                <form action={signOut}>
                  <button className="btn light" type="submit">
                    Logout
                  </button>
                </form>
              </>
            )}
          </div>
        </nav>
        <main className="container">
          <PageTransition>{children}</PageTransition>
        </main>
      </body>
    </html>
  );
}
