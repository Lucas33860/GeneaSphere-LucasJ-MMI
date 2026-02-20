import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { action, email, password } = body;

  if (action === "logout") {
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  }

  if (action === "login") {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ user: data.user });
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
