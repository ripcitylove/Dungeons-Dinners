import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");

const PRICE_MAP: Record<string, string> = {
  "Tavern Patron": process.env.STRIPE_PRICE_TAVERN || "",
  "Dungeon Master": process.env.STRIPE_PRICE_DM || "",
  "Legendary Hero": process.env.STRIPE_PRICE_LEGENDARY || "",
};

export async function POST(request: Request) {
  try {
    const { tier, userId } = await request.json();
    const priceId = PRICE_MAP[tier];

    if (!priceId) {
      return NextResponse.json({ error: "Invalid subscription tier" }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/dashboard?mock_success=true&tier=${encodeURIComponent(tier)}`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/pricing`,
      metadata: {
        userId: userId ?? "",
        priceId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[checkout]", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
