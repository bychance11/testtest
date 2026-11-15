import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SheetOptions } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;
export const cloudEnabled = !!supabase;

export const BUCKET = "sheets";

export interface SheetRow {
  id: string;
  user_id: string;
  preset: string;
  orientation: string;
  dpi: number;
  photo_count: number;
  storage_path: string;
  created_at: string;
}

/** 로그인 없이 쓰려면 Supabase 대시보드 > Auth > Anonymous sign-ins 를 켜야 함 */
export async function ensureSession() {
  if (!supabase) throw new Error("Supabase 미설정");
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anonData, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return anonData.session!;
}

export async function uploadSheet(blob: Blob, opt: SheetOptions, photoCount: number): Promise<SheetRow> {
  if (!supabase) throw new Error("Supabase 미설정");
  const session = await ensureSession();
  const uid = session.user.id;
  const id = crypto.randomUUID();
  const path = `${uid}/${id}.jpg`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg", upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.from("sheets").insert({
    id, preset: opt.presetId, orientation: opt.orientation, dpi: opt.dpi,
    photo_count: photoCount, storage_path: path,
  }).select().single();
  if (error) throw error;
  return data as SheetRow;
}

export async function listSheets(): Promise<SheetRow[]> {
  if (!supabase) return [];
  const { data } = await supabase.auth.getSession();
  if (!data.session) return [];
  const { data: rows, error } = await supabase.from("sheets").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return rows as SheetRow[];
}

export async function signedUrl(path: string, seconds = 600) {
  if (!supabase) throw new Error("Supabase 미설정");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteSheet(row: SheetRow) {
  if (!supabase) return;
  await supabase.storage.from(BUCKET).remove([row.storage_path]);
  await supabase.from("sheets").delete().eq("id", row.id);
}
