import nodemailer from "nodemailer";
import { Resend } from "resend";
import connectDB from "@/lib/db";
import EmailTemplate from "@/models/email-template";

const SMTP_FROM = process.env.SMTP_FROM || "no-reply@mail.packattack.gg";

// Use Resend in production, Nodemailer/SMTP for local dev
const resendApiKey = process.env.RESEND_API_KEY;

function getResend() {
  return new Resend(resendApiKey);
}

function getSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "1025", 10),
    secure: false,
  });
}

export function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export async function sendTemplateEmail(
  to: string,
  slug: string,
  lang: "de" | "en",
  variables: Record<string, string>
): Promise<void> {
  await connectDB();

  const template = await EmailTemplate.findOne({ slug });
  if (!template) {
    throw new Error(`Email template not found: ${slug}`);
  }

  const subject = interpolate(template.subject[lang], variables);
  const html = interpolate(template.body[lang], variables);

  if (resendApiKey) {
    const resend = getResend();
    await resend.emails.send({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
  } else {
    const transport = getSmtpTransport();
    await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
  }
}
