import { chromium } from 'playwright-core';

export async function renderBankReadyPdf(html: string): Promise<Buffer> {
  if (!html || !html.includes('<html')) throw new Error('invalid_render_html');
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (!executablePath) throw new Error('CHROMIUM_EXECUTABLE_PATH_not_configured');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    const bytes = Buffer.from(pdf);
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('invalid_pdf_output');
    return bytes;
  } finally { await browser.close(); }
}
