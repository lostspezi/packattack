"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ResetPasswordFormProps {
  dict: Record<string, string>;
  lang: string;
  token: string;
}

export function ResetPasswordForm({ dict, lang, token }: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-error text-sm">
          {dict["error_missing_token"] ?? "No reset token provided. Please request a new reset link."}
        </p>
        <Link
          href={`/${lang}/forgot-password`}
          className="text-pa-green hover:text-pa-green-hover text-sm font-medium"
        >
          {dict["link_request_new"] ?? "Request New Link"}
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        router.push(`/${lang}/login?reset=success`);
      } else {
        const data = await res.json();
        if (data.error === "invalid_or_expired_token") {
          setError(dict["error_invalid_token"] ?? "This link is invalid or has expired. Please request a new one.");
        } else {
          setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
        }
      }
    } catch {
      setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-text-secondary text-sm text-center">
        {dict["description"] ?? "Enter your new password below."}
      </p>

      <Input
        label={dict["label_password"] ?? "New Password"}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
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
        {dict["button_reset"] ?? "Reset Password"}
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
