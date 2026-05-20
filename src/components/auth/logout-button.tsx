"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/integrations/supabase/browser";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.refresh();
    router.replace("/login");
    setPending(false);
  }

  return (
    <Button
      className={cn(
        "h-8 w-full justify-start px-2.5 text-[13px] font-normal",
        className
      )}
      disabled={pending}
      onClick={() => void signOut()}
      type="button"
      variant="ghost"
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
