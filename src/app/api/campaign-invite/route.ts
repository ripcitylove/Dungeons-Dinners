import { NextRequest } from "next/server";
import { generateInviteToken, verifyInviteToken } from "../../../lib/inviteToken";

export async function GET(req: NextRequest) {
  const campaignId = req.nextUrl.searchParams.get("campaignId");
  if (!campaignId) return Response.json({ error: "campaignId required" }, { status: 400 });

  const token   = generateInviteToken(campaignId);
  const baseUrl = req.nextUrl.origin;
  const url     = `${baseUrl}/campaign/${campaignId}?invite=${token}`;

  return Response.json({ url });
}

export async function POST(req: NextRequest) {
  try {
    const { token, campaignId } = await req.json();
    if (!token || !campaignId) return Response.json({ valid: false }, { status: 400 });

    const valid = verifyInviteToken(token, campaignId);
    return valid
      ? Response.json({ valid: true })
      : Response.json({ valid: false }, { status: 401 });
  } catch {
    return Response.json({ valid: false }, { status: 400 });
  }
}
