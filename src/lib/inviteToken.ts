import { createHmac, randomBytes } from "crypto";

const secret = () => process.env.INVITE_SECRET ?? "dev-invite-secret-change-me";

export function generateInviteToken(campaignId: string): string {
  const nonce   = randomBytes(12).toString("hex");
  const payload = Buffer.from(JSON.stringify({ campaignId, nonce })).toString("base64url");
  const sig     = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyInviteToken(token: string, expectedCampaignId: string): boolean {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx < 0) return false;
    const payload = token.slice(0, dotIdx);
    const sig     = token.slice(dotIdx + 1);
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    if (expected !== sig) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.campaignId === expectedCampaignId;
  } catch {
    return false;
  }
}
