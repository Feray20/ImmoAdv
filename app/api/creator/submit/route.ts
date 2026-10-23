import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/notify/mail';
import { creatorCanSubmit, missingSteps, STEP_TITLE } from '@/lib/creator/model';
import { audit, creatorActor, j, onboardingState, ownCreator, requireCreatorUser } from '@/lib/creator/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Bewerbung einreichen. Vollständigkeit wird hier serverseitig erneut geprüft (inkl. bestätigter E-Mail-Adresse).
export async function POST(req: Request) {
  const g = await requireCreatorUser(req, 'submit', 6);
  if (!('user' in g)) return g;
  const c = await ownCreator(g.user.id);
  if (!c) return j({ error: 'Bitte zuerst die Bewerbung beginnen.' }, 404);
  if (!creatorCanSubmit(c.status)) return j({ error: 'Deine Bewerbung ist bereits eingereicht.' }, 409);
  const s = await onboardingState(c, g.user.id);
  const miss = missingSteps(s.state);
  if (miss.length) return j({ error: `Es fehlt noch: ${miss.map((m) => STEP_TITLE[m]).join(', ')}.`, missing: miss }, 400);
  const resubmit = c.status === 'INFO_REQUESTED';
  // Optimistische Sperre: nur wenn der Status sich seit dem Laden nicht geändert hat.
  const { data, error } = await supabaseAdmin().from('immo_creators')
    .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString(), info_request: null })
    .eq('id', c.id).eq('status', c.status).select('id');
  if (error || !data?.length) return j({ error: 'Einreichen fehlgeschlagen. Bitte Seite neu laden.' }, 409);
  await audit('APPLICATION_SUBMITTED', c.id, creatorActor(), 'SUCCESS', { resubmit });
  await sendMail(g.user.email, 'Deine Bewerbung als ImmoAdv Creator ist eingegangen',
    `Hallo ${c.first_name || ''},\n\ndanke für deine Bewerbung als ImmoAdv Creator Partner. Wir prüfen deine Angaben und melden uns per E-Mail, sobald die Prüfung abgeschlossen ist.\n\nDeinen Stand siehst du jederzeit im Creator-Bereich: https://immoadv.de/creator`,
    [], { title: 'Bewerbung eingegangen' }).catch(() => false);
  return j({ ok: true, status: 'SUBMITTED' });
}
