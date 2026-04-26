import sendgrid from "@sendgrid/mail";
import nodemailer from "nodemailer";
import { env, isConfigured } from "../config/env";

type SendEmailInput = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

function textToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>` : "<br />"))
    .join("");
}

export async function sendEmail(input: SendEmailInput) {
  const uniqueTo = Array.from(new Set(input.to.filter(Boolean)));
  if (!uniqueTo.length) {
    return { sent: false, provider: "none", reason: "No recipients" };
  }

  if (isConfigured(env.SENDGRID_API_KEY)) {
    sendgrid.setApiKey(env.SENDGRID_API_KEY!);
    await sendgrid.send({
      to: uniqueTo,
      from: env.SENDGRID_FROM_EMAIL,
      subject: input.subject,
      text: input.text,
      html: input.html ?? textToHtml(input.text)
    });
    return { sent: true, provider: "sendgrid" };
  }

  if (isConfigured(env.SMTP_HOST)) {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: isConfigured(env.SMTP_USER)
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        : undefined
    });

    await transporter.sendMail({
      from: env.SENDGRID_FROM_EMAIL,
      to: uniqueTo,
      subject: input.subject,
      text: input.text,
      html: input.html ?? textToHtml(input.text)
    });
    return { sent: true, provider: "smtp" };
  }

  console.info("Email provider not configured. Skipping send.", {
    to: uniqueTo,
    subject: input.subject
  });
  return { sent: false, provider: "console", reason: "Email provider not configured" };
}

export function summarySubject(meetingTitle: string) {
  return `${meetingTitle} - Summary and Action Items`;
}
