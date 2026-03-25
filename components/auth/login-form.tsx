"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";

interface LoginFormProps {
  dict: Record<string, string>;
  lang: string;
}

export function LoginForm({ dict, lang }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(dict["error_invalid_credentials"] ?? "Invalid email or password.");
      } else {
        router.push(`/${lang}/dashboard`);
      }
    } catch {
      setError(dict["error_unexpected"] ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        autoComplete="current-password"
      />

      {error && (
        <p className="text-error text-sm">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <Checkbox
          id="remember-me"
          label={dict["label_remember_me"] ?? "Remember me"}
          checked={rememberMe}
          onCheckedChange={setRememberMe}
        />
        <Link
          href={`/${lang}/forgot-password`}
          className="text-sm text-pa-green hover:text-pa-green-hover"
        >
          {dict["link_forgot_password"] ?? "Forgot password?"}
        </Link>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={loading}
        className="w-full"
      >
        {dict["button_login"] ?? "Log in"}
      </Button>

      <p className="text-center text-sm text-text-secondary">
        {dict["text_no_account"] ?? "Don't have an account?"}{" "}
        <Link
          href={`/${lang}/register`}
          className="text-pa-green hover:text-pa-green-hover font-medium"
        >
          {dict["link_register"] ?? "Register"}
        </Link>
      </p>
    </form>
  );
}
