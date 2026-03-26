"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface VerifyEmailFormProps {
  dict: Record<string, string>;
  lang: string;
  token?: string;
}

const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export function VerifyEmailForm({ dict, lang, token }: VerifyEmailFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const autoSentRef = useRef(false);

  // Auto-verify if token is in URL
  useEffect(() => {
    if (!token) return;

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          setStatus("success");
          window.location.replace(`/${lang}/dashboard`);
          return;
        } else {
          const data = await res.json();
          setStatus("error");
          if (data.error === "invalid_or_expired_token") {
            setErrorMsg(dict["error_invalid_token"] ?? "This link is invalid or has expired.");
          } else {
            setErrorMsg(dict["error_unexpected"] ?? "An unexpected error occurred.");
          }
        }
      } catch {
        setStatus("error");
        setErrorMsg(dict["error_unexpected"] ?? "An unexpected error occurred.");
      }
    }

    verify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-send verification email on first visit (no token = first time on page)
  useEffect(() => {
    if (token || autoSentRef.current) return;
    autoSentRef.current = true;
    sendVerificationEmail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown timer
  useEffect(() => {
    if (cooldownEnd <= Date.now()) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setCooldownRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEnd]);

  async function sendVerificationEmail() {
    setResendLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });

      if (res.ok) {
        setEmailSent(true);
        const end = Date.now() + RESEND_COOLDOWN_MS;
        setCooldownEnd(end);
        setCooldownRemaining(RESEND_COOLDOWN_MS);
      } else {
        const data = await res.json();
        if (data.error === "already_verified") {
          // Already verified — redirect
          window.location.replace(`/${lang}/dashboard`);
          return;
        } else if (data.error === "unauthorized") {
          router.push(`/${lang}/login`);
        } else {
          setErrorMsg(dict["error_resend_failed"] ?? "Failed to send verification email.");
        }
      }
    } catch {
      setErrorMsg(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setResendLoading(false);
    }
  }

  function formatCooldown(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  const isCooldownActive = cooldownRemaining > 0;

  if (status === "verifying") {
    return (
      <div className="text-center py-4">
        <div className="inline-block w-8 h-8 border-2 border-pa-green border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-text-secondary text-sm">
          {dict["verifying"] ?? "Verifying your email..."}
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <div className="text-pa-green text-4xl mb-3">✓</div>
        <p className="text-text-primary font-medium">
          {dict["success_title"] ?? "Email verified!"}
        </p>
        <p className="text-text-secondary text-sm mt-1">
          {dict["success_message"] ?? "Redirecting..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      {status === "error" && errorMsg ? (
        <p className="text-error text-sm">{errorMsg}</p>
      ) : emailSent ? (
        <p className="text-pa-green text-sm">
          {dict["resend_success"] ?? "Verification email sent! Check your inbox."}
        </p>
      ) : (
        <p className="text-text-secondary text-sm">
          {dict["check_email"] ?? "We're sending you a verification email..."}
        </p>
      )}

      {errorMsg && status !== "error" && (
        <p className="text-error text-sm">{errorMsg}</p>
      )}

      <Button
        type="button"
        variant="secondary"
        size="md"
        loading={resendLoading}
        disabled={isCooldownActive || resendLoading}
        onClick={sendVerificationEmail}
        className="w-full"
      >
        {isCooldownActive
          ? `${dict["resend_wait"] ?? "Erneut senden in"} ${formatCooldown(cooldownRemaining)}`
          : (dict["button_resend"] ?? "Resend Verification Email")}
      </Button>
    </div>
  );
}
