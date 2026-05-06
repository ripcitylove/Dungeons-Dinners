import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with a dummy key if env var is missing, to ensure the app doesn't crash during UI evaluation.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request) {
  try {
    const { tier } = await request.json();

    // Map the tiers to Stripe Price IDs (these would be set up in the Stripe Dashboard)
    const priceMap: { [key: string]: string } = {
      'Tavern Patron': process.env.STRIPE_PRICE_TAVERN || 'price_dummy_tavern',
      'Dungeon Master': process.env.STRIPE_PRICE_DM || 'price_dummy_dm',
      'Legendary Hero': process.env.STRIPE_PRICE_LEGENDARY || 'price_dummy_legendary',
    };

    const priceId = priceMap[tier];

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    // If we have actual Stripe keys, we would create a checkout session
    if (process.env.STRIPE_SECRET_KEY) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: \`\${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/dashboard?session_id={CHECKOUT_SESSION_ID}\`,
        cancel_url: \`\${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/pricing\`,
      });

      return NextResponse.json({ url: session.url });
    } else {
      // For demonstration, just return a mock success URL
      return NextResponse.json({ url: \`http://localhost:3001/dashboard?mock_success=true&tier=\${encodeURIComponent(tier)}\` });
    }

  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
