import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/notify/mail';
import { audit, j, requireCreatorAdmin } from '@/lib/creator/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Veröffentlichte Inhalte prüfen (z. B. Werbekennzeichnung, Aussagen zu Leistungen).
export async function GET(req: Request) {
  const a = await requireCreatorAdmin(req, 'creators.list');
  if (!('role' in a)) return a;
  const status = new URL(req.url).searchParams.get('status');
  let q = supabaseAdmin().from('immo_creator_content').select('id, creator_id, campaign_id, platform, url, title, published_on, ad_disclosure, status, review_note, created_at, immo_creators(display_name), immo_creator_campaigns(name, slug)').order('created_at', { ascending: false }).limit(300);
  if (status && ['SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED'].includes(status)) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return j({ error: 'Liste konnte nicht geladen werden.' }, 500);
  return j({ content: data ?? [] });
}

const Review = z.object({ id: z.string().uuid(), status: z.enum(['APPROVED', 'CHANGES_REQUESTED']), note: z.string().trim().max(1000).nullable().optional() });

export async function POST(req: Request) {
  const a = await requireCreatorAdmin(req, 'content.review');
  if (!('role' in a)) return a;
  const p = Review.safeParse(await req.json().catch(() => null));
  if (!p.success) return j({ error: 'Ungültig.' }, 400);
  if (p.data.status === 'CHANGES_REQUESTED' && !p.data.note) return j({ error: 'Bitte eine Anmerkung für den Creator angeben.', field: 'note' }, 400);
  const db = supabaseAdmin();
  const { data, error } = await db.from('immo_creator_content').update({ status: p.data.status, review_note: p.data.note || null, reviewed_at: new Date().toISOString() })
    .eq('id', p.data.id).select('creator_id, url').single();
  if (error || !data) return j({ error: 'Nicht gefunden.' }, 404);
  const row = data as { creator_id: string; url: string };
  await audit('CONTENT_REVIEWED', row.creator_id, a.actor, 'SUCCESS', { status: p.data.status });
  if (p.data.status === 'CHANGES_REQUESTED') {
    const { data: c } = await db.from('immo_creators').select('user_id, first_name').eq('id', row.creator_id).maybeSingle();
    const { data: u } = c?.user_id ? await db.auth.admin.getUserById(c.user_id) : { data: null };
    if (u?.user?.email) await sendMail(u.user.email, 'Anmerkung zu deinem Beitrag', `Hallo ${c?.first_name || ''},\n\nzu deinem Beitrag ${row.url} hat ImmoAdv eine Anmerkung:\n\n${p.data.note}\n\nDu kannst den Beitrag im Creator Studio anpassen: https://immoadv.de/creator#studio`, [], { title: 'Anmerkung zu deinem Beitrag' }).catch(() => false);
  }
  return j({ ok: true });
}
