import { createHash, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { z } from 'zod';
import { allowRequest } from '@/lib/security/rate-limit';
import { userFromRequest } from '@/lib/billing/auth';
import { billingEnabled, entitlementsFor, findCustomer, stripe } from '@/lib/billing/stripe';
import { buildKreditmappe } from '@/lib/kreditmappe/model';
import { loadMappeInput } from '@/lib/kreditmappe/load';
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin';
import { KreditmappeDocument, type Verification } from '@/lib/kreditmappe/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({ objectId: z.string().min(4).max(40) });
const LEDGER_KEY = 'kreditmappe_objects';

// Erstellt die Kreditmappe als PDF für ein gespeichertes Objekt des angemeldeten Nutzers.
// Freischaltung: Pro oder eine gekaufte Kreditmappe. Verbrauchte Mappen werden je Objekt
// serverseitig in den Metadaten des Stripe-Kunden vermerkt; erneutes Erstellen desselben Objekts ist kostenfrei.
export async function POST(req: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: 'Die Kreditmappe ist noch nicht verfügbar.' }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Bitte zuerst anmelden.' }, { status: 401 });
  if (!allowRequest(`kreditmappe:${user.id}`, 6, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen. Bitte kurz warten.' }, { status: 429 });
  }

  const parsedBody = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const { objectId } = parsedBody.data;

  const loaded = await loadMappeInput(req, user.id, objectId);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const { object, profile, uploads } = loaded.data;

  // Freischaltung prüfen und Verbrauch vermerken.
  try {
    const ent = await entitlementsFor(user.id, user.email);
    if (!ent.pro && adminConfigured()) {
      // Atomar über den Primärschlüssel (owner_id, object_ref): parallele Anfragen können
      // ein Guthaben nicht doppelt verbrauchen; erneutes Erstellen desselben Objekts bleibt kostenfrei.
      const db = supabaseAdmin();
      const ins = await db
        .from('immo_kreditmappe_credits')
        .upsert({ owner_id: user.id, object_ref: objectId }, { onConflict: 'owner_id,object_ref', ignoreDuplicates: true })
        .select('object_ref');
      if (ins.error) throw new Error(ins.error.message);
      if (ins.data && ins.data.length > 0) {
        const { count, error: cErr } = await db
          .from('immo_kreditmappe_credits')
          .select('object_ref', { count: 'exact', head: true })
          .eq('owner_id', user.id);
        if (cErr) throw new Error(cErr.message);
        if ((count ?? 0) > ent.creditMaps) {
          await db.from('immo_kreditmappe_credits').delete().eq('owner_id', user.id).eq('object_ref', objectId);
          return NextResponse.json({ error: 'Für dieses Objekt ist keine Kreditmappe freigeschaltet.' }, { status: 402 });
        }
      }
    } else if (!ent.pro) {
      const customer = await findCustomer(user.id, user.email);
      const used = (customer?.metadata?.[LEDGER_KEY] || '').split(',').filter(Boolean);
      if (!used.includes(objectId)) {
        if (!customer || used.length >= ent.creditMaps) {
          return NextResponse.json({ error: 'Für dieses Objekt ist keine Kreditmappe freigeschaltet.' }, { status: 402 });
        }
        const next = [...used, objectId].join(',');
        if (next.length > 500) return NextResponse.json({ error: 'Kontingent-Speicher voll. Bitte Support kontaktieren.' }, { status: 409 });
        await stripe().customers.update(customer.id, { metadata: { [LEDGER_KEY]: next } });
      }
    }
  } catch (e) {
    console.error('kreditmappe_entitlement_error', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Freischaltung konnte nicht geprüft werden.' }, { status: 502 });
  }

  try {
    const mappe = buildKreditmappe(object, profile, new Date(), uploads);

    // Version und Prüf-QR vorbereiten. Die Prüfsumme kann nicht im PDF selbst stehen;
    // der QR-Code enthält deshalb eine zufällige Versions-Kennung, der Hash wird nach dem Rendern gespeichert.
    let verify: Verification | undefined;
    if (adminConfigured()) {
      const { data: last } = await supabaseAdmin()
        .from('immo_kreditmappe_versions')
        .select('version_no')
        .eq('owner_id', user.id)
        .eq('object_ref', objectId)
        .order('version_no', { ascending: false })
        .limit(1)
        .maybeSingle();
      const versionId = randomUUID();
      const url = `${new URL(req.url).origin}/verify/${versionId}`;
      const qrDataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 240, color: { dark: '#0F172A', light: '#FFFFFF' } });
      verify = { versionNo: (Number(last?.version_no) || 0) + 1, versionId, url, qrDataUrl };
    }

    const element = createElement(KreditmappeDocument, { m: mappe, verify }) as unknown as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(element);
    if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('invalid_pdf_output');
    // Hash erst nach dem Rendern aus den tatsächlichen Bytes berechnen.
    const sha256 = createHash('sha256').update(pdf).digest('hex');

    if (verify) {
      const db = supabaseAdmin();
      const path = `${user.id}/${verify.versionId}.pdf`;
      const up = await db.storage.from('bank-ready-pdf').upload(path, pdf, { contentType: 'application/pdf', upsert: false });
      if (!up.error) {
        await db.from('immo_kreditmappe_versions').insert({
          id: verify.versionId, owner_id: user.id, object_ref: objectId, version_no: verify.versionNo,
          sha256, byte_size: pdf.length, storage_path: path,
        });
      } else {
        console.error('kreditmappe_store_error', up.error.message);
      }
    }
    const filename = `ImmoAdv_Kreditmappe_${object.name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'X-Document-SHA256': sha256,
        'X-Document-Version': verify ? String(verify.versionNo) : '',
        'Access-Control-Expose-Headers': 'X-Document-SHA256, X-Document-Version, Content-Disposition',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('kreditmappe_render_error', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'PDF konnte nicht erstellt werden.' }, { status: 500 });
  }
}
