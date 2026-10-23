// Standard-Material für Creator (Logos und Screenshots aus public/creator-kit): wird beim ersten Aufruf der
// Material-Seite einmalig in den privaten Speicher „creator-assets“ übernommen und dort wie hochgeladenes Material
// verwaltet (Admin kann es bearbeiten, deaktivieren oder ersetzen). Textvorlagen werden per Datenbank angelegt.
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ASSET_BUCKET } from '@/lib/creator/server';

const KEY = 'creator_kit_v1';
const LOGO_NOTE = 'Nicht verzerren, umfärben oder mit Effekten versehen. Rundherum etwas Freiraum lassen.';
const SHOT_NOTE = 'Echte Ansicht von immoadv.de. Ausschnitte und Größenänderungen sind erlaubt, Inhalte bitte nicht verändern.';
const FILES: { file: string; title: string; kind: 'logo' | 'image'; description: string; usage_notes: string }[] = [
  { file: 'immoadv-logo-blau.png', title: 'ImmoAdv Logo (blau)', kind: 'logo', description: 'Für helle Hintergründe. Transparent, 2400 px breit.', usage_notes: LOGO_NOTE },
  { file: 'immoadv-logo-weiss.png', title: 'ImmoAdv Logo (weiß)', kind: 'logo', description: 'Für dunkle Hintergründe und Fotos. Transparent, 2400 px breit.', usage_notes: LOGO_NOTE },
  { file: 'immoadv-symbol.png', title: 'ImmoAdv Symbol', kind: 'logo', description: 'Nur das Bildzeichen, z. B. für Profilbild-Overlays oder kleine Flächen. Transparent, 1024 px.', usage_notes: LOGO_NOTE },
  { file: 'screenshot-startseite-story.png', title: 'Screenshot Startseite (Story-Format)', kind: 'image', description: 'Hochformat für Stories, Reels und TikTok (1080 × 1920).', usage_notes: SHOT_NOTE },
  { file: 'screenshot-kaufnebenkosten-rechner-story.png', title: 'Screenshot Kaufnebenkosten-Rechner (Story-Format)', kind: 'image', description: 'Hochformat (1080 × 1920): Grunderwerbsteuer je Bundesland.', usage_notes: SHOT_NOTE },
  { file: 'screenshot-kreditmappe-beispiel-story.png', title: 'Screenshot Muster-Kreditmappe (Story-Format)', kind: 'image', description: 'Hochformat (1080 × 1920): So sieht die Kreditmappe aus (Musterfall).', usage_notes: SHOT_NOTE },
  { file: 'screenshot-startseite-desktop.png', title: 'Screenshot Startseite (Desktop)', kind: 'image', description: 'Querformat 1440 × 900, z. B. für YouTube und Präsentationen.', usage_notes: SHOT_NOTE },
  { file: 'screenshot-kaufnebenkosten-rechner-desktop.png', title: 'Screenshot Kaufnebenkosten-Rechner (Desktop)', kind: 'image', description: 'Querformat 1440 × 900.', usage_notes: SHOT_NOTE },
  { file: 'screenshot-kreditmappe-beispiel-desktop.png', title: 'Screenshot Muster-Kreditmappe (Desktop)', kind: 'image', description: 'Querformat 1440 × 900.', usage_notes: SHOT_NOTE },
];

export async function ensureCreatorKit(origin: string): Promise<void> {
  const db = supabaseAdmin();
  // Sperre: nur ein Aufruf legt das Material an; danach nie wieder.
  const lock = await db.from('immo_settings').insert({ key: KEY, value: 'running', updated_by: 'system:creator-kit' });
  if (lock.error) return;
  try {
    for (const f of FILES) {
      const r = await fetch(`${origin}/creator-kit/${f.file}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`${f.file}: HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      const id = randomUUID(), path = `assets/${id}/${f.file}`;
      const up = await db.storage.from(ASSET_BUCKET).upload(path, buf, { contentType: 'image/png', upsert: false });
      if (up.error) throw new Error(`${f.file}: ${up.error.message}`);
      const ins = await db.from('immo_creator_assets').insert({ id, title: f.title, description: f.description, usage_notes: f.usage_notes, kind: f.kind, storage_path: path, mime: 'image/png', size_bytes: buf.length, active: true, created_by: 'system:creator-kit' });
      if (ins.error) throw new Error(`${f.file}: ${ins.error.message}`);
    }
    await db.from('immo_settings').update({ value: 'done', updated_at: new Date().toISOString() }).eq('key', KEY);
  } catch (e) {
    console.error('creator_kit', e instanceof Error ? e.message : e);
    await db.from('immo_settings').delete().eq('key', KEY); // beim nächsten Aufruf erneut versuchen (ohne Doppelungen: bereits angelegte bleiben)
    await db.from('immo_creator_assets').delete().eq('created_by', 'system:creator-kit').eq('kind', 'image').is('campaign_id', null).then(() => null, () => null);
  }
}
