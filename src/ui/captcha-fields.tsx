"use client";

import { useEffect, useState } from "react";
import { Input } from "@/ui/input";

export function useCaptchaChallenge() {
  const [challenge, setChallenge] = useState<{ id: string; prompt: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/security/challenge")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.data?.id) setChallenge({ id: payload.data.id, prompt: payload.data.prompt });
      })
      .catch(() => setChallenge(null));
  }, []);

  return challenge;
}

export function CaptchaFields({
  challenge,
  label,
}: {
  challenge: { id: string; prompt: string } | null;
  label: string;
}) {
  if (!challenge) return null;
  return (
    <>
      <input type="hidden" name="captchaId" value={challenge.id} />
      <Input name="captchaAnswer" label={`${label}: ${challenge.prompt}`} required autoComplete="off" />
    </>
  );
}
