// Sofort-Meldungen an den Betreiber zusätzlich zur E-Mail: Telegram-Bot und/oder Slack-/Discord-kompatibler Webhook.
// Konfiguration (alle optional): ALERT_TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID, ALERT_WEBHOOK_URL (https).
// Inhalte ohne personenbezogene Daten (nur Art, Anzahl, gekürzte Quell-Kennung).
export const pushConfigured = () => Boolean((process.env.ALERT_TELEGRAM_BOT_TOKEN && process.env.ALERT_TELEGRAM_CHAT_ID) || process.env.ALERT_WEBHOOK_URL);

export async function pushAlert(text: string): Promise<{ telegram?: boolean; webhook?: boolean }> {
  const out: { telegram?: boolean; webhook?: boolean } = {};
  const msg = text.slice(0, 3500);
  const tok = process.env.ALERT_TELEGRAM_BOT_TOKEN, chat = process.env.ALERT_TELEGRAM_CHAT_ID;
  if (tok && chat && /^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(tok)) {
    out.telegram = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg, disable_web_page_preview: true }), signal: AbortSignal.timeout(5000),
    }).then((r) => r.ok, () => false);
  }
  const hook = process.env.ALERT_WEBHOOK_URL;
  if (hook && /^https:\/\//.test(hook)) {
    // „text“ versteht Slack, „content“ versteht Discord; andere Dienste erhalten beide Felder.
    out.webhook = await fetch(hook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg, content: msg }), signal: AbortSignal.timeout(5000),
    }).then((r) => r.ok, () => false);
  }
  return out;
}
