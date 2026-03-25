"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

interface AcceptTermsFormProps {
  dict: Record<string, string>;
  lang: string;
  tosVersion: string;
  privacyVersion: string;
}

export function AcceptTermsForm({
  dict,
  lang,
  tosVersion,
  privacyVersion,
}: AcceptTermsFormProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!acceptTos || !acceptPrivacy) {
      setError(dict["error_accept_both"] ?? "You must accept both the Terms of Service and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        // Refresh session so JWT picks up the new consent versions
        await updateSession();
        router.push(`/${lang}/dashboard`);
      } else {
        setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
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
        {dict["description"] ?? "We've updated our terms. Please review and accept to continue."}
      </p>

      <div className="rounded-lg border border-border p-4 flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="accept-tos"
            checked={acceptTos}
            onCheckedChange={setAcceptTos}
          />
          <label htmlFor="accept-tos" className="text-sm text-text-secondary leading-tight pt-0.5">
            {dict["label_accept_tos_prefix"] ?? "I accept the"}{" "}
            <Link
              href={`/${lang}/terms`}
              target="_blank"
              className="text-pa-green hover:text-pa-green-hover font-medium"
            >
              {dict["link_tos"] ?? "Terms of Service"}
            </Link>
            {tosVersion && (
              <span className="text-text-muted text-xs ml-1">v{tosVersion}</span>
            )}
          </label>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="accept-privacy"
            checked={acceptPrivacy}
            onCheckedChange={setAcceptPrivacy}
          />
          <label htmlFor="accept-privacy" className="text-sm text-text-secondary leading-tight pt-0.5">
            {dict["label_accept_privacy_prefix"] ?? "I accept the"}{" "}
            <Link
              href={`/${lang}/privacy`}
              target="_blank"
              className="text-pa-green hover:text-pa-green-hover font-medium"
            >
              {dict["link_privacy"] ?? "Privacy Policy"}
            </Link>
            {privacyVersion && (
              <span className="text-text-muted text-xs ml-1">v{privacyVersion}</span>
            )}
          </label>
        </div>
      </div>

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
        {dict["button_accept"] ?? "Accept & Continue"}
      </Button>
    </form>
  );
}
