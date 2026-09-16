import nodemailer from "nodemailer";

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

// Table-based layout with inline styles: mail clients strip <style>
// blocks and have no flexbox, so this is the format that survives.
const template = ({ heading, intro, action, link, footer }) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7f3;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2ebe2;border-radius:14px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<tr><td style="padding:30px 32px 0;">
<div style="font-size:23px;font-weight:700;letter-spacing:-1px;color:#1f5c39;">memify<span style="color:#f2a03d;">.</span></div>
</td></tr>
<tr><td style="padding:22px 32px 0;">
<h1 style="margin:0 0 12px;font-size:21px;line-height:1.35;color:#1e3329;font-weight:600;">${escape(heading)}</h1>
<p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#51604f;">${escape(intro)}</p>
</td></tr>
<tr><td style="padding:0 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:8px;background:#1f6b41;">
<a href="${escape(link)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escape(action)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:22px 32px 0;">
<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#7d8c78;">Or paste this link into your browser:</p>
<p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${escape(link)}" style="color:#2f8a55;">${escape(link)}</a></p>
</td></tr>
<tr><td style="padding:24px 32px 30px;">
<p style="margin:0;padding-top:18px;border-top:1px solid #eef2ec;font-size:12px;line-height:1.6;color:#8a978a;">${escape(footer)}</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#9aa696;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">Memify · a little practice, a lasting memory</p>
</td></tr></table>
</body></html>`;

const messages = {
  verify: {
    subject: "Verify your email · Memify",
    heading: "Confirm your email",
    intro:
      "You're one click from your workspace. Confirming your address unlocks AI generation and keeps your account recoverable.",
    action: "Verify my email",
    footer:
      "This link expires in one hour and can be used once. If you didn't create a Memify account, you can ignore this email.",
  },
  reset: {
    subject: "Reset your password · Memify",
    heading: "Choose a new password",
    intro:
      "We received a request to reset your Memify password. Use the button below to set a new one.",
    action: "Reset my password",
    footer:
      "This link expires in one hour and can be used once. If you didn't request a reset, ignore this email — your password will not change.",
  },
};

export function createMailer(config) {
  const transport = config.smtpHost
    ? nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        requireTLS: Boolean(config.production),
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        auth: config.smtpUser
          ? { user: config.smtpUser, pass: config.smtpPassword }
          : undefined,
      })
    : null;
  return async (email, kind, link) => {
    if (!transport) {
      // Without SMTP the link is surfaced in the console and returned to
      // the caller, so local development never needs a mail server.
      if (config.production)
        throw new Error("Email delivery is not configured");
      console.info(`[Local email] ${kind}: ${link}`);
      return link;
    }
    const copy = messages[kind] || messages.verify;
    await transport.sendMail({
      from: config.mailFrom,
      to: email,
      subject: copy.subject,
      text: `${copy.heading}\n\n${copy.intro}\n\n${link}\n\n${copy.footer}`,
      html: template({ ...copy, link }),
    });
  };
}
