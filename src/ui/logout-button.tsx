"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";
import { Button } from "@/ui/button";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: false }),
    });
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" onClick={logout}>
      {label}
    </Button>
  );
}
