"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signUp(formData: FormData) {
  const fullName = formData.get("fullName")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const supabase = await createClient();
  const parsed = z
    .object({
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8)
    })
    .safeParse({ fullName, email, password });
  if (!parsed.success) return;

  await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`
    }
  });
  redirect("/auth?checkEmail=1");
}

export async function signIn(formData: FormData) {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const supabase = await createClient();
  const { data } = await supabase.auth.signInWithPassword({ email, password });
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut();
    redirect("/auth?verifyRequired=1");
  }
  redirect("/");
}

export async function adminSignIn(formData: FormData) {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const supabase = await createClient();
  const { data } = await supabase.auth.signInWithPassword({ email, password });
  const userId = data.user?.id;
  if (!userId) redirect("/admin/login?error=1");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login?notAdmin=1");
  }

  redirect("/admin/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth");
}

export async function applyAsSeller(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const paymentMethod =
    (formData.get("paymentMethod")?.toString() as "stripe" | "mobile_money" | null) ??
    null;
  const payNow = formData.get("payNow")?.toString() === "yes";

  const { data: application } = await supabase
    .from("seller_applications")
    .upsert(
    {
      user_id: user.id,
      store_name: formData.get("storeName"),
      business_description: formData.get("businessDescription"),
      contact_phone: formData.get("contactPhone"),
      business_image_url: formData.get("businessImageUrl"),
      application_fee_payment_state: payNow ? "pending" : "unpaid",
      status: "pending"
    },
    { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (!application) redirect("/seller/apply?submitted=1");

  const applicationFee = 10000;
  if (payNow && paymentMethod === "stripe" && stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: { name: "Seller Application Fee" },
            unit_amount: Math.round((applicationFee / 650) * 100)
          }
        }
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/seller/apply?feePaid=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/seller/apply?feeCancelled=1`
    });
    await supabase
      .from("seller_applications")
      .update({
        application_fee_payment_reference: `seller_fee:${session.id}`,
        application_fee_payment_state: "pending"
      })
      .eq("id", application.id);
    redirect(session.url ?? "/seller/apply");
  }

  if (payNow && paymentMethod === "mobile_money") {
    if (process.env.FLUTTERWAVE_SECRET_KEY) {
      const txRef = `seller_fee-${application.id}`;
      const payload = {
        tx_ref: txRef,
        amount: applicationFee,
        currency: "XAF",
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/seller/apply?feePaid=1`,
        payment_options: "mobilemoneyghana,mobilemoneyrwanda,mobilemoneyzambia",
        customer: {
          email: user.email
        },
        customizations: {
          title: "Elysian Commerce Seller Fee"
        }
      };

      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const paymentLink: string | undefined = data?.data?.link;
      await supabase
        .from("seller_applications")
        .update({
          application_fee_payment_reference: txRef,
          application_fee_payment_state: "pending"
        })
        .eq("id", application.id);
      if (paymentLink) redirect(paymentLink);
    }
  }

  redirect("/seller/apply?submitted=1");
}

export async function reviewSellerApplication(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const applicationId = formData.get("applicationId")?.toString();
  const action = formData.get("action")?.toString();
  const userId = formData.get("userId")?.toString();
  if (!applicationId || !action || !userId) return;

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: admin } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (admin?.role !== "admin") return;

  if (action === "approve") {
    await adminClient
      .from("seller_applications")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null
      })
      .eq("id", applicationId);
    await adminClient.from("profiles").update({ role: "seller" }).eq("id", userId);
    const { data: app } = await adminClient
      .from("seller_applications")
      .select("store_name,contact_phone,business_description,business_image_url")
      .eq("id", applicationId)
      .single();
    if (app) {
      await adminClient
        .from("profiles")
        .update({
          store_name: app.store_name,
          phone: app.contact_phone,
          bio: app.business_description,
          avatar_url: app.business_image_url,
          store_verified: true
        })
        .eq("id", userId);
    }
  } else if (action === "reject") {
    await adminClient
      .from("seller_applications")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: "Not eligible yet"
      })
      .eq("id", applicationId);
    await adminClient.from("profiles").update({ store_verified: false }).eq("id", userId);
  }

  redirect("/admin/sellers");
}

export async function requestSellerPayment(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const applicationId = formData.get("applicationId")?.toString();
  const userId = formData.get("userId")?.toString();
  if (!applicationId || !userId) return;

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

  await adminClient.from("notifications").insert({
    user_id: userId,
    sender_id: user.id,
    title: "Seller Application Payment Required",
    body: "Please pay the seller application fee before final confirmation, or contact support.",
    type: "announcement"
  });

  await adminClient
    .from("seller_applications")
    .update({ application_fee_payment_state: "unpaid" })
    .eq("id", applicationId);

  redirect("/admin/sellers");
}

export async function createAdCampaign(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "buyer") redirect("/ads?onlyBuyers=1");

  const title = formData.get("title")?.toString() ?? "";
  const description = formData.get("description")?.toString() ?? "";
  const targetUrl = formData.get("targetUrl")?.toString() ?? "";
  const imageUrl = formData.get("imageUrl")?.toString() ?? "";
  const budget = Number(formData.get("budget") ?? 0);
  const paymentMethod = (formData.get("paymentMethod")?.toString() ??
    "stripe") as "stripe" | "mobile_money";
  if (!title || !description || !targetUrl || budget <= 0) return;

  const { data: ad } = await supabase
    .from("ad_campaigns")
    .insert({
      user_id: user.id,
      title,
      description,
      target_url: targetUrl,
      image_url: imageUrl || null,
      budget,
      payment_method: paymentMethod,
      payment_state: "pending",
      status: "pending_payment"
    })
    .select("id")
    .single();
  if (!ad) return;

  if (paymentMethod === "stripe" && stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: { name: `Ad Campaign: ${title}` },
            unit_amount: Math.max(100, Math.round((budget / 650) * 100))
          }
        }
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/ads?paid=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/ads?cancelled=1`
    });
    await supabase
      .from("ad_campaigns")
      .update({
        payment_reference: `ad:${session.id}`,
        payment_state: "pending"
      })
      .eq("id", ad.id);
    redirect(session.url ?? "/ads");
  }

  if (paymentMethod === "mobile_money") {
    if (process.env.FLUTTERWAVE_SECRET_KEY) {
      const txRef = `ad-${ad.id}`;
      const payload = {
        tx_ref: txRef,
        amount: budget,
        currency: "XAF",
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/ads?paid=1`,
        payment_options: "mobilemoneyghana,mobilemoneyrwanda,mobilemoneyzambia",
        customer: {
          email: user.email
        },
        customizations: {
          title: "Elysian Commerce Ad Campaign"
        }
      };

      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const paymentLink: string | undefined = data?.data?.link;
      await supabase
        .from("ad_campaigns")
        .update({
          payment_reference: txRef,
          payment_state: "pending"
        })
        .eq("id", ad.id);
      if (paymentLink) redirect(paymentLink);
    }
  }

  redirect("/ads");
}

export async function reviewAdCampaign(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const adId = formData.get("adId")?.toString();
  const action = formData.get("action")?.toString();
  if (!adId || !action) return;

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

  const { data: ad } = await adminClient
    .from("ad_campaigns")
    .select("id,user_id,payment_state,title")
    .eq("id", adId)
    .single();
  if (!ad) return;

  if (action === "approve") {
    if (ad.payment_state !== "paid" && ad.payment_state !== "waived") {
      await adminClient.from("notifications").insert({
        user_id: ad.user_id,
        sender_id: user.id,
        title: "Ad Payment Required",
        body: "Please complete payment for your ad campaign before approval.",
        type: "announcement"
      });
      redirect("/admin/dashboard");
    }
    await adminClient
      .from("ad_campaigns")
      .update({
        status: "approved",
        approved_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null
      })
      .eq("id", adId);
    await adminClient.from("notifications").insert({
      user_id: ad.user_id,
      sender_id: user.id,
      title: "Ad Approved",
      body: `Your ad campaign "${ad.title}" has been approved.`,
      type: "announcement"
    });
  }

  if (action === "reject") {
    await adminClient
      .from("ad_campaigns")
      .update({
        status: "rejected",
        approved_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: "Rejected by admin review"
      })
      .eq("id", adId);
    await adminClient.from("notifications").insert({
      user_id: ad.user_id,
      sender_id: user.id,
      title: "Ad Rejected",
      body: `Your ad campaign "${ad.title}" was rejected by admin.`,
      type: "announcement"
    });
  }

  if (action === "waive_payment") {
    await adminClient
      .from("ad_campaigns")
      .update({
        payment_state: "waived",
        status: "approved",
        approved_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null
      })
      .eq("id", adId);
    await adminClient.from("notifications").insert({
      user_id: ad.user_id,
      sender_id: user.id,
      title: "Ad Fee Waived",
      body: `Your ad campaign "${ad.title}" was approved without payment.`,
      type: "announcement"
    });
  }

  redirect("/admin/dashboard");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  await supabase
    .from("profiles")
    .update({
      full_name: formData.get("fullName"),
      phone: formData.get("phone"),
      bio: formData.get("bio"),
      avatar_url: formData.get("avatarUrl")
    })
    .eq("id", user.id);

  redirect("/profile?saved=1");
}

export async function createAdminAccount(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/");

  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const fullName = formData.get("fullName")?.toString() ?? "";
  if (!email || !password || password.length < 8 || !fullName) return;

  const { data: created } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (created.user?.id) {
    await adminClient
      .from("profiles")
      .update({ role: "admin", store_name: "Elysian Store", store_verified: true })
      .eq("id", created.user.id);
  }
  redirect("/admin/dashboard?created=1");
}

export async function updateUserRole(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/");

  const userId = formData.get("userId")?.toString();
  const role = formData.get("role")?.toString();
  if (!userId || !role || !["buyer", "seller", "admin"].includes(role)) return;

  const payload: Record<string, string | boolean> = { role };
  if (role === "admin") {
    payload.store_name = "Elysian Store";
    payload.store_verified = true;
  }
  await adminClient.from("profiles").update(payload).eq("id", userId);
  redirect("/admin/dashboard");
}

export async function createAdminStoreProduct(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
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

  await adminClient.from("products").insert({
    seller_id: user.id,
    category_id: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: Number(formData.get("price")),
    stock: Number(formData.get("stock")),
    image_url: formData.get("imageUrl"),
    is_active: true
  });
  redirect("/admin/dashboard");
}

export async function updateAdminStoreProduct(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
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

  const productId = formData.get("productId")?.toString();
  if (!productId) return;
  const { data: product } = await adminClient
    .from("products")
    .select("id,seller_id,profiles!products_seller_id_fkey(role)")
    .eq("id", productId)
    .single();
  const profileRef = (product as Record<string, unknown> | null)?.profiles as
    | { role?: string }
    | Array<{ role?: string }>
    | undefined;
  const ownerRole = Array.isArray(profileRef) ? profileRef[0]?.role : profileRef?.role;
  if (ownerRole !== "admin") return;

  await adminClient
    .from("products")
    .update({
      title: formData.get("title"),
      description: formData.get("description"),
      price: Number(formData.get("price")),
      stock: Number(formData.get("stock")),
      image_url: formData.get("imageUrl"),
      category_id: formData.get("categoryId")
    })
    .eq("id", productId);
  redirect("/admin/dashboard");
}

export async function deleteAdminStoreProduct(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
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

  const productId = formData.get("productId")?.toString();
  if (!productId) return;

  const { data: product } = await adminClient
    .from("products")
    .select("id,profiles!products_seller_id_fkey(role)")
    .eq("id", productId)
    .single();
  const profileRef = (product as Record<string, unknown> | null)?.profiles as
    | { role?: string }
    | Array<{ role?: string }>
    | undefined;
  const ownerRole = Array.isArray(profileRef) ? profileRef[0]?.role : profileRef?.role;
  if (ownerRole !== "admin") return;

  await adminClient.from("products").delete().eq("id", productId);
  redirect("/admin/dashboard");
}

export async function updateOrderStatus(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const orderId = formData.get("orderId")?.toString();
  const nextStatus = formData.get("nextStatus")?.toString();
  if (!orderId || !nextStatus) return;

  const validStatuses = new Set([
    "pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled"
  ]);
  if (!validStatuses.has(nextStatus)) return;

  const [{ data: me }, { data: order }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    adminClient
      .from("orders")
      .select("id,status,seller_id,buyer_id")
      .eq("id", orderId)
      .single()
  ]);
  if (!order || !me?.role) return;

  if (me.role === "seller" && order.seller_id !== user.id) return;
  if (me.role === "admin") {
    const { data: sellerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", order.seller_id)
      .single();
    if (sellerProfile?.role !== "admin") return;
  }
  if (me.role === "buyer") return;

  const current = order.status;
  const allowed: Record<string, string[]> = {
    pending: ["processing", "cancelled"],
    paid: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: []
  };
  if (!allowed[current]?.includes(nextStatus)) return;

  await adminClient.from("orders").update({ status: nextStatus }).eq("id", orderId);
  const timestampPayload: Record<string, string | null> = {};
  if (nextStatus === "processing") timestampPayload.confirmed_at = new Date().toISOString();
  if (nextStatus === "shipped") timestampPayload.shipped_at = new Date().toISOString();
  if (nextStatus === "delivered") timestampPayload.delivered_at = new Date().toISOString();
  if (nextStatus === "cancelled") timestampPayload.cancelled_at = new Date().toISOString();
  if (Object.keys(timestampPayload).length) {
    await adminClient.from("orders").update(timestampPayload).eq("id", orderId);
  }

  const statusTextMap: Record<string, string> = {
    processing: "confirmed",
    shipped: "shipped",
    delivered: "delivered",
    cancelled: "cancelled"
  };
  const readable = statusTextMap[nextStatus] ?? nextStatus;

  const { data: convo } = await adminClient
    .from("conversations")
    .upsert(
      {
        buyer_id: order.buyer_id,
        seller_id: order.seller_id
      },
      { onConflict: "buyer_id,seller_id" }
    )
    .select("id")
    .single();

  if (convo?.id) {
    await adminClient.from("messages").insert({
      conversation_id: convo.id,
      sender_id: order.seller_id,
      content: `Order ${order.id.slice(0, 8)} has been ${readable}.`
    });
  }

  await adminClient.from("notifications").insert({
    user_id: order.buyer_id,
    sender_id: order.seller_id,
    title: "Order Update",
    body: `Your order ${order.id.slice(0, 8)} is now ${readable}.`,
    type: "order"
  });

  if (me.role === "admin") {
    redirect("/admin/dashboard");
  }
  redirect("/seller/dashboard");
}

export async function sendPlatformNotification(formData: FormData) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
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

  const title = formData.get("title")?.toString() ?? "";
  const body = formData.get("body")?.toString() ?? "";
  const targetRole = formData.get("targetRole")?.toString() ?? "all";
  if (!title || !body) return;

  let profileQuery = adminClient.from("profiles").select("id");
  if (targetRole === "buyers") profileQuery = profileQuery.eq("role", "buyer");
  if (targetRole === "sellers") profileQuery = profileQuery.eq("role", "seller");
  if (targetRole === "admins") profileQuery = profileQuery.eq("role", "admin");

  const { data: recipients } = await profileQuery;
  if (!recipients?.length) return;

  const payload = recipients.map((recipient) => ({
    user_id: recipient.id,
    sender_id: user.id,
    title,
    body,
    type: "announcement"
  }));

  await adminClient.from("notifications").insert(payload);
  redirect("/admin/dashboard?noticeSent=1");
}

export async function markNotificationRead(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const notificationId = formData.get("notificationId")?.toString();
  if (!notificationId) return;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  await supabase.from("products").insert({
    seller_id: user.id,
    category_id: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    image_url: formData.get("imageUrl"),
    is_active: true
  });

  redirect("/seller/dashboard");
}

export async function addToWishlist(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  await supabase.from("wishlists").upsert({
    user_id: user.id,
    product_id: formData.get("productId")
  });
}

export async function removeFromWishlist(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  await supabase
    .from("wishlists")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", formData.get("productId"));
}

export async function createConversation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const sellerId = formData.get("sellerId")?.toString();
  if (!sellerId) return;

  const { data } = await supabase
    .from("conversations")
    .upsert(
      {
        buyer_id: user.id,
        seller_id: sellerId
      },
      { onConflict: "buyer_id,seller_id" }
    )
    .select("id")
    .single();

  if (data?.id) redirect(`/chat/${data.id}`);
}

export async function sendMessage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  await supabase.from("messages").insert({
    conversation_id: formData.get("conversationId"),
    sender_id: user.id,
    content: formData.get("content")
  });
}

export async function placeOrder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const productId = formData.get("productId")?.toString();
  const quantity = Number(formData.get("quantity") ?? 1);
  const paymentMethod = formData.get("paymentMethod")?.toString() ?? "cash_on_delivery";
  const shippingAddress = formData.get("shippingAddress")?.toString() ?? "";

  if (!productId || !shippingAddress || quantity < 1) return;

  const { data: product } = await supabase
    .from("products")
    .select("id, title, price, stock, seller_id")
    .eq("id", productId)
    .single();

  if (!product || product.stock < quantity) return;
  const total = Number(product.price) * quantity;

  const { data: order } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: product.seller_id,
      payment_method: paymentMethod,
      status: paymentMethod === "cash_on_delivery" ? "processing" : "pending",
      shipping_address: shippingAddress,
      total_amount: total,
      confirmed_at:
        paymentMethod === "cash_on_delivery" ? new Date().toISOString() : null
    })
    .select("id")
    .single();

  if (!order) return;

  await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    quantity,
    unit_price: product.price
  });

  await supabase
    .from("products")
    .update({ stock: product.stock - quantity })
    .eq("id", product.id);

  if (paymentMethod === "stripe" && stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: "usd",
            product_data: { name: product.title },
            unit_amount: Math.round(Number(product.price) * 100)
          }
        }
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/orders?paid=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout?cancelled=1`
    });
    await supabase
      .from("orders")
      .update({ payment_reference: session.id })
      .eq("id", order.id);
    redirect(session.url ?? "/orders");
  }

  if (paymentMethod === "mobile_money") {
    if (process.env.FLUTTERWAVE_SECRET_KEY) {
      const txRef = `ec-${order.id}`;
      const payload = {
        tx_ref: txRef,
        amount: total,
        currency: "USD",
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/orders?mobile_money=1`,
        payment_options: "mobilemoneyghana,mobilemoneyrwanda,mobilemoneyzambia",
        customer: {
          email: user.email
        },
        customizations: {
          title: "Elysian Commerce Order"
        }
      };

      const res = await fetch("https://api.flutterwave.com/v3/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      const paymentLink: string | undefined = data?.data?.link;
      await supabase
        .from("orders")
        .update({ payment_reference: txRef })
        .eq("id", order.id);
      if (paymentLink) redirect(paymentLink);
    } else {
      await supabase
        .from("orders")
        .update({ payment_reference: "mobile_money_pending" })
        .eq("id", order.id);
    }
  }

  redirect("/orders");
}

export async function createReview(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  await supabase.from("reviews").insert({
    order_item_id: formData.get("orderItemId"),
    buyer_id: user.id,
    product_id: formData.get("productId"),
    rating: Number(formData.get("rating")),
    comment: formData.get("comment")
  });
  redirect("/orders");
}
