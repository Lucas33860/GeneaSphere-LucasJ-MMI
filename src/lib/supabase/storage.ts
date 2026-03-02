import { createClient } from "./client";

/** Upload a photo file to the member-photos bucket and return the public URL, or null on failure. */
export async function uploadMemberPhoto(file: File): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { data: uploaded, error } = await supabase.storage
    .from("member-photos")
    .upload(path, file, { upsert: true });
  if (error || !uploaded) return null;

  const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(uploaded.path);
  return urlData.publicUrl;
}
