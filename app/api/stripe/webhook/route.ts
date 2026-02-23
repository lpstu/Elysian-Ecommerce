import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.STRIPE_SECRET_KEY
  ) {
    return NextResponse.json({ error: "Missing Supabase env" }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil"
  });
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const sig = req.headers.get("stripe-signature");
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("payment_reference", session.id);
    await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("payment_reference", `order:${session.id}`);
    await admin
      .from("ad_campaigns")
      .update({ payment_state: "paid", status: "pending_review" })
      .eq("payment_reference", `ad:${session.id}`);
    await admin
      .from("seller_applications")
      .update({ application_fee_payment_state: "paid" })
      .eq("application_fee_payment_reference", `seller_fee:${session.id}`);
  }

  return NextResponse.json({ received: true });
}
