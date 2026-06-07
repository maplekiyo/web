// Memo image storage in the private Supabase `memos` bucket.

import { supabaseAdmin } from "@/lib/supabase";

const BUCKET = process.env.SUPABASE_MEMO_BUCKET ?? "memos";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Upload a base64 image. `objectKey` is the object path without extension
 * (e.g. "sheets/<uuid>"). Returns the full storage path (stored in memos.image_path).
 */
export async function uploadImage(
  objectKey: string,
  base64: string,
  mediaType: string,
): Promise<string> {
  const ext = EXT[mediaType] ?? "jpg";
  const path = `${objectKey}.${ext}`;
  const bytes = Buffer.from(base64, "base64");
  const { error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mediaType, upsert: true });
  if (error) throw error;
  return path;
}

/** Short-lived signed URL for viewing a stored memo image. */
export async function signedMemoImageUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
