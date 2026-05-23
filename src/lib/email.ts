import { createElement } from "react";

export type SendInviteArgs = {
  to: string;
  teamName: string;
  inviterEmail: string;
  role: string;
  link: string;
};

// Sends the invite email via Resend, degrading gracefully when unconfigured:
// without RESEND_API_KEY (or on any send failure) it returns { sent: false }
// and the caller still surfaces the copyable invite link in the UI. Resend and
// the template are imported lazily so the UI shell never pulls them in.
export async function sendInviteEmail(args: SendInviteArgs): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY not configured" };

  try {
    const { Resend } = await import("resend");
    const InviteEmail = (await import("@/emails/InviteEmail")).default;
    const resend = new Resend(apiKey);
    const from = process.env.INVITE_EMAIL_FROM || "Onstage <onboarding@resend.dev>";

    const { error } = await resend.emails.send({
      from,
      to: args.to,
      subject: `You're invited to ${args.teamName} on Onstage`,
      react: createElement(InviteEmail, args),
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "send failed" };
  }
}
