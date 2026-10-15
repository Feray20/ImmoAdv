export type EvidenceStatus = "VERIFIED" | "REVIEW_REQUIRED" | "CONFLICT";

export interface EvidenceRef {
  id: string;
  documentId: string;
  page?: number;
  field: string;
  confidence: number;
  extractionMethod: "OCR" | "MANUAL" | "IMPORT" | "AI_EXTRACTION";
  excerptHash?: string;
  status: EvidenceStatus;
}

export interface EvidenceValue<T> {
  value: T;
  evidence: EvidenceRef[];
  status: EvidenceStatus;
}

export const EVIDENCE_REVIEW_THRESHOLD = 0.85;

export function evidenceStatus(confidence: number): EvidenceStatus {
  return confidence >= EVIDENCE_REVIEW_THRESHOLD ? "VERIFIED" : "REVIEW_REQUIRED";
}

export function assertCriticalEvidence<T>(input: EvidenceValue<T>): T {
  if (input.status !== "VERIFIED") {
    throw new Error("critical_evidence_not_verified");
  }
  if (input.evidence.length === 0) {
    throw new Error("critical_evidence_missing");
  }
  if (input.evidence.some((ref) => ref.confidence < EVIDENCE_REVIEW_THRESHOLD || ref.status !== "VERIFIED")) {
    throw new Error("critical_evidence_requires_review");
  }
  return input.value;
}
