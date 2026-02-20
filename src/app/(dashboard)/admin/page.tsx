import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/ui/LogoutButton";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_admin")
    .eq("id", user.id)
    .single();

  // Seuls les admins ont accès
  if (!profile?.is_admin) redirect("/dashboard");

  const name = profile?.full_name ?? user.email;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold text-gray-800">
          Bonjour {name}{" "}
          <span className="text-purple-600 font-normal">· Admin</span>
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
