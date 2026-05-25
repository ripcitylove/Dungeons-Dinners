import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const TIER_MAP: Record<string, string> = {
  [process.env.STRIPE_PRICE_TAVERN ?? ""]: "tavern",
  [process.env.STRIPE_PRICE_DM ?? ""]: "dm",
  [process.env.STRIPE_PRICE_LEGENDARY ?? ""]: "legendary",
};

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const priceId = session.metadata?.priceId;
    const tier = TIER_MAP[priceId ?? ""] ?? "free";

    if (userId) {
      const { error } = await supabase.from("user_profiles").upsert({
        id: userId,
        stripe_customer_id: session.customer as string,
        subscription_tier: tier,
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      });
      if (error) console.error("[stripe-webhook] upsert error:", error);
      else console.log(`[stripe-webhook] activated ${tier} for user ${userId}`);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const { error } = await supabase
      .from("user_profiles")
      .update({ subscription_tier: "free", subscription_status: "inactive", updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", sub.customer as string);
    if (error) console.error("[stripe-webhook] downgrade error:", error);
    else console.log(`[stripe-webhook] downgraded customer ${sub.customer} to free`);
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const priceId = sub.items.data[0]?.price?.id;
    const tier = TIER_MAP[priceId ?? ""] ?? "free";
    const status = sub.status === "active" ? "active" : "inactive";
    await supabase
      .from("user_profiles")
      .update({ subscription_tier: tier, subscription_status: status, updated_at: new Date().toISOString() })
      .eq("stripe_customer_id", sub.customer as string);
  }

  return new Response("OK");
}
