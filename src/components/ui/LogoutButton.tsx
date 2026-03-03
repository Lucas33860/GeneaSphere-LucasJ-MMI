"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
    >
      Se déconnecter
    </button>
  );
}
