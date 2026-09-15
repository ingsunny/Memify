import nodemailer from "nodemailer";
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
      if (config.production)
        throw new Error("Email delivery is not configured");
      console.info(`[Local email] ${kind}: ${link}`);
      return link;
    }
    await transport.sendMail({
      from: config.mailFrom,
      to: email,
      subject:
        kind === "verify"
          ? "Welcome to Memify — verify your email"
          : "Reset your Memify password",
      text: `${kind === "verify" ? "Verify your email to unlock your free generations." : "Use this link to reset your password."}\n\n${link}\n\nThis link expires in one hour. If you did not request it, ignore this email.`,
    });
  };
}
