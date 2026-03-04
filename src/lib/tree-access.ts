import type { SupabaseClient } from "@supabase/supabase-js";

export type TreeRole = "owner" | "admin" | "editor" | "reader";

export async function getUserTreeRole(
  supabase: SupabaseClient,
  treeId: string,
  userId: string,
): Promise<TreeRole | null> {
  const { data: tree } = await supabase
    .from("trees").select("owner_id").eq("id", treeId).single();
  if (!tree) return null;
  if (tree.owner_id === userId) return "owner";
  const { data: access } = await supabase
    .from("tree_access").select("role")
    .eq("tree_id", treeId).eq("user_id", userId).single();
  return (access?.role as TreeRole) ?? null;
}

export const canWrite  = (r: TreeRole | null) => r === "owner" || r === "admin" || r === "editor";
export const canDelete = (r: TreeRole | null) => r === "owner" || r === "admin";
export const canShare  = (r: TreeRole | null) => r === "owner" || r === "admin";
