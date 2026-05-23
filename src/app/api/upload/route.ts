import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not an image" }, { status: 400 });

  const admin = createAdminClient();
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error } = await admin.storage
    .from("screenshots")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = admin.storage.from("screenshots").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
