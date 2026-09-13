"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";
import type { OAuthProvider } from "@/auth/providers";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";

type AuthFormProps = {
  mode: "login" | "register";
  oauthProviders: OAuthProvider[];
  labels: {
    title: string;
    email: string;
    password: string;
    name?: string;
    submit: string;
    passwordHint?: string;
    magicLink: string;
    magicLinkSent: string;
    optionalPassword: string;
    or: string;
    continueWith: string;
  };
};

export function AuthForm({ mode, labels, oauthProviders }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");
    const intent = String(formData.get("intent") ?? "magic");

    if (intent === "magic") {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/dashboard",
      });
      setPending(false);
      if (result.error) {
        setError(result.error.message ?? "Unable to send magic link");
        return;
      }
      setMagicSent(true);
      return;
    }

    const result =
      mode === "register"
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Authentication failed");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={onSubmit} className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{labels.title}</h1>
        {mode === "register" && labels.name ? (
          <Input name="name" label={labels.name} autoComplete="name" minLength={2} />
        ) : null}
        <Input
          name="email"
          type="email"
          label={labels.email}
          autoComplete="email"
          required
        />
        {showPassword ? (
          <Input
            name="password"
            type="password"
            label={labels.password}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={8}
            hint={labels.passwordHint}
          />
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {magicSent ? (
          <p role="status" className="text-sm text-zinc-700">
            {labels.magicLinkSent}
          </p>
        ) : null}
        <Button type="submit" name="intent" value="magic" disabled={pending}>
          {labels.magicLink}
        </Button>
        {showPassword ? (
          <Button type="submit" name="intent" value="password" variant="secondary" disabled={pending}>
            {labels.submit}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowPassword(true)}
          >
            {labels.optionalPassword}
          </Button>
        )}
      </form>
      {oauthProviders.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-center text-sm text-zinc-500">{labels.or}</p>
          {oauthProviders.map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="secondary"
              onClick={() =>
                authClient.signIn.social({
                  provider,
                  callbackURL: "/dashboard",
                })
              }
            >
              {labels.continueWith} {provider}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
