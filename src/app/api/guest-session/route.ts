import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { verifyInviteToken } from "../../../lib/inviteToken";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { token, campaignId } = await req.json();
    if (!verifyInviteToken(token, campaignId)) {
      return Response.json({ error: "Invalid invite" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Admin createUser bypasses anonymous sign-in settings and captcha entirely
    const guestId  = randomBytes(8).toString("hex");
    const email    = `guest-${guestId}@play.dndlegends.app`;
    const password = randomBytes(16).toString("hex");

    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_guest: true },
    });

    if (createErr || !userData.user) {
      console.error("[guest-session] createUser:", createErr?.message);
      return Response.json({ error: "Could not create guest account" }, { status: 500 });
    }

    return Response.json({ email, password });
  } catch (err) {
    console.error("[guest-session]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
