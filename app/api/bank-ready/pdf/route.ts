import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Production gate for the Bank-Ready PDF pipeline.
 * The route deliberately does not fabricate a PDF: a renderer must return
 * real PDF bytes before hashing or persisting anything.
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { package_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.package_id) {
    return NextResponse.json({ error: 'package_id_required' }, { status: 400 });
  }

  // The actual PDF renderer is intentionally isolated behind this gate.
  // No bytes are persisted until a renderer produces a valid PDF signature.
  const pdfSignature = Buffer.from('%PDF-');
  const hash = crypto.createHash('sha256').update(pdfSignature).digest('hex');

  return NextResponse.json({
    status: 'renderer_pending',
    package_id: body.package_id,
    integrity: {
      algorithm: 'SHA-256',
      example_signature_hash: hash,
      persistence: 'disabled_until_real_pdf_renderer_is_available'
    }
  }, { status: 501 });
}
