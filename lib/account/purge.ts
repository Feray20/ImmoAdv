// Konto endgültig löschen (Art. 17 DSGVO) – gemeinsam für „Konto löschen“ im Konto und für den Web-Admin.
// Dateien, Protokolle ohne Fremdschlüssel und der Zugang werden entfernt; Profil, Objekte, Dokumente, Freigaben,
// Versionen und ein eigenes Unternehmenskonto folgen per CASCADE. Rechnungen bleiben nach § 147 AO erhalten
// (Fremdschlüssel auf das Unternehmenskonto wird auf NULL gesetzt).
import { DOCUMENT_BUCKET, supabaseAdmin } from '@/lib/supabase/admin';

async function removeFolder(bucket: string, prefix: string): Promise<void> {
  const store = supabaseAdmin().storage.from(bucket);
  for (let round = 0; round < 50; round++) {
    const { data, error } = await store.list(prefix, { limit: 1000 });
    if (error || !data?.length) return;
    const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
    const dirs = data.filter((f) => !f.id).map((f) => `${prefix}/${f.name}`);
    for (const d of dirs) await removeFolder(bucket, d);
    if (files.length) await store.remove(files);
    if (data.length < 1000) return;
  }
}

export async function purgeUser(userId: string, b2bAccountId: string | null, email?: string | null): Promise<void> {
  const db = supabaseAdmin();
  if (b2bAccountId) {
    await removeFolder('b2b-logos', b2bAccountId);
    await removeFolder('b2b-verify', b2bAccountId);
  }
  await removeFolder(DOCUMENT_BUCKET, userId);
  await removeFolder('bank-ready-pdf', userId);
  await removeFolder('immo-exports', userId);

  // Protokolle mit SET NULL und Tabellen ohne Fremdschlüssel ausdrücklich löschen.
  await db.from('immo_data_room_access_log').delete().eq('owner_id', userId);
  await db.from('immo_access_audit').delete().eq('owner_id', userId);
  await db.from('immo_kreditmappe_credits').delete().eq('owner_id', userId);
  await db.from('immo_audit_log').delete().eq('actor_user_id', userId);
  await db.from('immo_feedback').delete().eq('user_id', userId);
  await db.from('immo_review_requests').delete().eq('user_id', userId);
  await db.from('immo_access_grants').delete().eq('user_id', userId);
  if (email) await db.from('immo_newsletter').delete().eq('email', email.toLowerCase());

  // Ältere Bank-Pakete (falls vorhanden) haben RESTRICT-Abhängigkeiten.
  const { data: pk } = await db.from('immo_bank_packages').select('id').eq('owner_id', userId);
  const ids = (pk ?? []).map((x) => x.id as string);
  if (ids.length) {
    await db.from('immo_bank_share_events').delete().in('package_id', ids);
    await db.from('immo_bank_share_links').delete().in('package_id', ids);
    await db.from('immo_bank_pdf_audit').delete().in('package_id', ids);
    await db.from('immo_bank_pdf_versions').delete().in('package_id', ids);
  }

  const del = await db.auth.admin.deleteUser(userId);
  if (del.error) throw new Error(del.error.message);
}
