import { supabase } from "@/lib/supabase";

export const LEGAL_VERSION = "2026-09-12";
export const LEGAL_EFFECTIVE_DATE = "September 12, 2026";

export type LegalAcceptanceSource = "email" | "apple";

/**
 * Records the exact documents accepted after authentication establishes the
 * user's identity. Account creation must not continue if this audit record
 * cannot be written.
 */
export async function recordLegalAcceptance(source: LegalAcceptanceSource): Promise<void> {
  const { error } = await supabase.rpc("record_legal_acceptance", {
    p_terms_version: LEGAL_VERSION,
    p_privacy_version: LEGAL_VERSION,
    p_source: source
  });
  if (error) {
    throw new Error("We couldn't record your agreement. Please try again.");
  }
}
