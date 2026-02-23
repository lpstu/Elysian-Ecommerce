import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Missing Supabase env" }, { status: 500 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const body = await req.json();
  const txRef = body?.data?.tx_ref as string | undefined;
  const status = body?.data?.status as string | undefined;

  if (!txRef) return NextResponse.json({ ok: false }, { status: 400 });
  if (status === "successful") {
    if (txRef.startsWith("ad-")) {
      await admin
        .from("ad_campaigns")
        .update({ payment_state: "paid", status: "pending_review" })
        .eq("payment_reference", txRef);
    } else if (txRef.startsWith("seller_fee-")) {
      await admin
        .from("seller_applications")
        .update({ application_fee_payment_state: "paid" })
        .eq("application_fee_payment_reference", txRef);
    } else {
      await admin.from("orders").update({ status: "paid" }).eq("payment_reference", txRef);
    }
  }

  return NextResponse.json({ ok: true });
}
