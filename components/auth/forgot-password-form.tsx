"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ForgotPasswordFormProps {
  dict: Record<string, string>;
  lang: string;
}

export function ForgotPasswordForm({ dict, lang }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
      }
    } catch {
      setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="text-pa-green text-4xl mb-1">✓</div>
        <p className="text-text-primary font-medium">
          {dict["success_title"] ?? "Check your email"}
        </p>
        <p className="text-text-secondary text-sm">
          {dict["success_message"] ??
            "If an account with that email exists, we've sent a password reset link."}
        </p>
        <Link
          href={`/${lang}/login`}
          className="text-pa-green hover:text-pa-green-hover text-sm font-medium"
        >
          {dict["link_back_to_login"] ?? "Back to Login"}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-text-secondary text-sm text-center">
        {dict["description"] ?? "Enter your email and we'll send you a reset link."}
      </p>

      <Input
        label={dict["label_email"] ?? "Email"}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      {error && (
        <p className="text-error text-sm">{error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={loading}
        className="w-full"
      >
        {dict["button_send"] ?? "Send Reset Link"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        <Link
          href={`/${lang}/login`}
          className="text-pa-green hover:text-pa-green-hover font-medium"
        >
          {dict["link_back_to_login"] ?? "Back to Login"}
        </Link>
      </p>
    </form>
  );
}
