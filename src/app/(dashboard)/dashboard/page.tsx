import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/ui/LogoutButton";

export default async function DashboardPage() {
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

  // Si c'est un admin, rediriger vers la page admin
  if (profile?.is_admin) redirect("/admin");

  const name = profile?.full_name ?? user.email;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold text-gray-800">
          Bonjour {name}{" "}
          <span className="text-blue-600 font-normal">· Client</span>
        </p>
        <LogoutButton />
      </div>
    </main>
  );
}
