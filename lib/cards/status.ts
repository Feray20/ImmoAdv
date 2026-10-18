// Produktstatus der ImmoAdv Card. Ohne angeschlossenen Kartenherausgeber, Identifizierung und Zahlungsdienst
// ist nichts „live“ – die Oberfläche zeigt dann ehrlich „In Vorbereitung“ bzw. „Nicht eingerichtet“.
export type ProgramStatus = 'LIVE' | 'SANDBOX' | 'COMING_SOON' | 'NOT_CONFIGURED';
export type CapabilityStatus = 'IMPLEMENTED' | 'READY_FOR_INTEGRATION' | 'NOT_CONFIGURED' | 'COMPLIANCE_PENDING';

export function programStatus(env: Record<string, string | undefined> = process.env): ProgramStatus {
  const s = (env.CARD_PROGRAM_STATUS || '').toUpperCase();
  const provider = Boolean(env.CARD_PROVIDER_API_URL && env.CARD_PROVIDER_API_KEY);
  if (s === 'LIVE' && provider && env.CARD_COMPLIANCE_APPROVED === 'true') return 'LIVE';
  if (s === 'SANDBOX' && provider) return 'SANDBOX';
  if (!provider) return s === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : 'COMING_SOON';
  return 'COMING_SOON';
}

export function capabilities(env: Record<string, string | undefined> = process.env): Record<string, CapabilityStatus> {
  const card = Boolean(env.CARD_PROVIDER_API_URL && env.CARD_PROVIDER_API_KEY);
  const ident = Boolean(env.IDENTITY_PROVIDER_API_URL && env.IDENTITY_PROVIDER_API_KEY);
  const compliance = env.CARD_COMPLIANCE_APPROVED === 'true';
  return {
    limitEngine: 'IMPLEMENTED',
    pricingDirectory: 'IMPLEMENTED',
    pricingPdf: 'IMPLEMENTED',
    cardIssuing: card ? (compliance ? 'IMPLEMENTED' : 'COMPLIANCE_PENDING') : 'READY_FOR_INTEGRATION',
    identification: ident ? (compliance ? 'IMPLEMENTED' : 'COMPLIANCE_PENDING') : 'READY_FOR_INTEGRATION',
    sepa: 'READY_FOR_INTEGRATION',
    statements: 'READY_FOR_INTEGRATION',
    walletPay: 'NOT_CONFIGURED',
  };
}
