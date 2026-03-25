"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

interface RegisterFormProps {
  dict: Record<string, string>;
  lang: string;
}

export function RegisterForm({ dict, lang }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!acceptTos || !acceptPrivacy) {
      setError(dict["error_accept_terms"] ?? "You must accept the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          email,
          password,
          acceptTos,
          acceptPrivacy,
          lang,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "email_taken") {
          setError(dict["error_email_taken"] ?? "This email is already registered.");
        } else if (data.error === "username_taken") {
          setError(dict["error_username_taken"] ?? "This username is already taken.");
        } else {
          setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
        }
        return;
      }

      router.push(`/${lang}/verify-email`);
    } catch {
      setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label={dict["label_name"] ?? "Full Name"}
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

      <Input
        label={dict["label_password"] ?? "Password"}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
      />

      <div className="flex flex-col gap-3">
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
        {dict["button_register"] ?? "Create Account"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        {dict["text_have_account"] ?? "Already have an account?"}{" "}
        <Link
          href={`/${lang}/login`}
          className="text-pa-green hover:text-pa-green-hover font-medium"
        >
          {dict["link_login"] ?? "Log in"}
        </Link>
      </p>
    </form>
  );
}
