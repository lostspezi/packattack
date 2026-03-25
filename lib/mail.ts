import nodemailer from "nodemailer";
import connectDB from "@/lib/db";
import EmailTemplate from "@/models/email-template";

const SMTP_HOST = process.env.SMTP_HOST || "localhost";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_FROM = process.env.SMTP_FROM || "noreply@packattack.gg";

function getTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
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

  const transport = getTransport();
  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });
}
