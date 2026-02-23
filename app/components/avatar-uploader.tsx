"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AvatarUploader({
  userId,
  currentValue
}: {
  userId: string;
  currentValue?: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(currentValue ?? "");

  async function onPickFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const filePath = `${userId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("avatars").upload(filePath, file, {
      upsert: true
    });
    if (!error) {
      const {
        data: { publicUrl }
      } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setUrl(publicUrl);
    }
    setUploading(false);
  }

  return (
    <div className="grid" style={{ gap: "0.5rem" }}>
      <label className="help">Profile picture</label>
      <input type="file" accept="image/*" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
      <input type="url" name="avatarUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Or paste image URL" />
      {uploading ? <p className="help">Uploading image...</p> : null}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Profile avatar" className="product-image" style={{ height: 180 }} />
      ) : null}
    </div>
  );
}
