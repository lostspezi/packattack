"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface VerifyEmailFormProps {
  dict: Record<string, string>;
  lang: string;
  token?: string;
}

export function VerifyEmailForm({ dict, lang, token }: VerifyEmailFormProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(
    token ? "verifying" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

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
          // Force session refresh so JWT picks up the new emailVerified value
          await updateSession();
          // Redirect immediately via full page reload
          // Proxy will route to onboarding (OAuth) or dashboard (completed)
          window.location.replace(`/${lang}/dashboard`);
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

  async function handleResend() {
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang }),
      });

      if (res.ok) {
        setResendSent(true);
      } else {
        const data = await res.json();
        if (data.error === "already_verified") {
          setErrorMsg(dict["error_already_verified"] ?? "Your email is already verified.");
        } else if (data.error === "unauthorized") {
          router.push(`/${lang}/login`);
        } else {
          setErrorMsg(dict["error_resend_failed"] ?? "Failed to resend verification email.");
        }
      }
    } catch {
      setErrorMsg(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setResendLoading(false);
    }
  }

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
          {dict["success_message"] ?? "Redirecting to dashboard..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      {status === "error" && errorMsg ? (
        <>
          <p className="text-error text-sm">{errorMsg}</p>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={resendLoading}
            onClick={handleResend}
            className="w-full"
          >
            {dict["button_resend"] ?? "Resend Verification Email"}
          </Button>
        </>
      ) : resendSent ? (
        <p className="text-pa-green text-sm">
          {dict["resend_success"] ?? "Verification email sent! Check your inbox."}
        </p>
      ) : (
        <>
          <p className="text-text-secondary text-sm">
            {dict["check_email"] ?? "Check your email for a verification link."}
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={resendLoading}
            onClick={handleResend}
            className="w-full"
          >
            {dict["button_resend"] ?? "Resend Verification Email"}
          </Button>
        </>
      )}

      {errorMsg && status !== "error" && (
        <p className="text-error text-sm">{errorMsg}</p>
      )}
    </div>
  );
}
