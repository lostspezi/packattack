"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateSelect } from "@/components/ui/date-select";
import Link from "next/link";

interface OnboardingFormProps {
  dict: Record<string, string>;
  lang: string;
  initialName: string;
  initialUsername: string;
  initialEmail: string;
  hasPassword: boolean;
}

export function OnboardingForm({
  dict,
  lang,
  initialName,
  initialUsername,
  initialEmail,
  hasPassword,
}: OnboardingFormProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptAge, setAcceptAge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const maxYear = new Date().getFullYear() - 18;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!acceptTos || !acceptPrivacy || !acceptAge) {
      setError(dict["error_accept_terms"] ?? "You must accept all terms.");
      return;
    }

    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        name,
        username,
        email,
        dateOfBirth,
        acceptTos: true,
        acceptPrivacy: true,
        acceptAge: true,
      };

      if (!hasPassword && password) {
        body.password = password;
      }

      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email_taken") {
          setError(dict["error_email_taken"] ?? "This email is already registered.");
        } else if (data.error === "username_taken") {
          setError(dict["error_username_taken"] ?? "This username is already taken.");
        } else if (data.error === "age_requirement") {
          setError(dict["error_age_requirement"] ?? "You must be at least 18 years old.");
        } else {
          setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
        }
        return;
      }

      // Refresh session so JWT picks up onboardingCompleted: true
      await updateSession();
      router.push(`/${lang}/dashboard`);
    } catch {
      setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={dict["label_name"] ?? "Name"}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoComplete="name"
      />

      <Input
        label={dict["label_username"] ?? "Username"}
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        autoComplete="username"
      />

      <Input
        label={dict["label_email"] ?? "Email"}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      {!hasPassword && (
        <Input
          label={dict["label_password"] ?? "Password"}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      )}

      <DateSelect
        label={dict["label_date_of_birth"] ?? "Date of Birth"}
        value={dateOfBirth}
        onChange={setDateOfBirth}
        maxYear={maxYear}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="onboarding-accept-tos"
            checked={acceptTos}
            onCheckedChange={setAcceptTos}
          />
          <label htmlFor="onboarding-accept-tos" className="text-sm text-text-secondary leading-tight pt-0.5">
            {dict["checkbox_tos"] ?? "I accept the"}{" "}
            <Link
              href={`/${lang}/terms`}
              target="_blank"
              className="text-pa-green hover:text-pa-green-hover font-medium"
            >
              {dict["link_tos"] ?? "Terms of Service"}
            </Link>
          </label>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="onboarding-accept-privacy"
            checked={acceptPrivacy}
            onCheckedChange={setAcceptPrivacy}
          />
          <label htmlFor="onboarding-accept-privacy" className="text-sm text-text-secondary leading-tight pt-0.5">
            {dict["checkbox_privacy"] ?? "I accept the"}{" "}
            <Link
              href={`/${lang}/privacy`}
              target="_blank"
              className="text-pa-green hover:text-pa-green-hover font-medium"
            >
              {dict["link_privacy"] ?? "Privacy Policy"}
            </Link>
          </label>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="onboarding-accept-age"
            checked={acceptAge}
            onCheckedChange={setAcceptAge}
          />
          <label htmlFor="onboarding-accept-age" className="text-sm text-text-secondary leading-tight pt-0.5">
            {dict["checkbox_age"] ?? "I confirm I am at least 18 years old"}
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
        {dict["button_complete"] ?? "Complete & Continue"}
      </Button>
    </form>
  );
}
