// CAC Verification Service
// In production: replace this lookup with an HTTP call to a live provider
// (e.g. Mono, Dojah) and store credentials in .env
// Mock data lives in src/data/cac-mock-db.json — swap it out without touching this file.

import mockDatabase from "../data/cac-mock-db.json";

export interface CACRecord {
  businessName: string;
  businessType: string;
  status: string;
  rcNumber: string;
  registeredAddress: string;
  state: string;
  natureOfBusiness: string;
  registrationDate: string;
}

export type LookupResult =
  | { found: true; error: null; cacDetails: CACRecord }
  | { found: false; error: string; field: string | null };

/**
 * Look up a CAC record and validate each submitted field against it.
 * Returns a field-specific error so the frontend can highlight the exact
 * input that is wrong without revealing the correct value.
 *
 * @param rcNumber          - Required. Primary lookup key.
 * @param businessName      - Required. Must match the record (case-insensitive).
 * @param businessType      - Optional. Validated if provided.
 * @param registeredAddress - Optional. Validated if provided.
 */
export async function lookupCAC(
  rcNumber: string,
  businessName: string,
  businessType?: string,
  registeredAddress?: string,
): Promise<LookupResult> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const db = mockDatabase as Record<string, CACRecord>;
  const record = db[rcNumber.trim().toUpperCase()];

  if (!record) {
    return {
      found: false,
      field: "rcNumber",
      error:
        "RC Number not found in the CAC Registry. Please double-check the number on your certificate.",
    };
  }

  if (record.status !== "Active") {
    return {
      found: false,
      field: "rcNumber",
      error:
        "This business is not currently active in the CAC Registry. Contact CAC to resolve your registration status.",
    };
  }

  const inputName = businessName.trim().toUpperCase();
  const cacName = record.businessName.trim().toUpperCase();
  if (inputName !== cacName && !cacName.includes(inputName)) {
    return {
      found: false,
      field: "businessName",
      error:
        "Business name does not match the CAC record for this RC Number. Ensure it is identical to your official certificate.",
    };
  }

  if (businessType && businessType.trim() !== "") {
    if (businessType.trim() !== record.businessType.trim()) {
      return {
        found: false,
        field: "businessType",
        error:
          "Business type does not match the CAC record for this RC Number. Select the exact type shown on your CAC certificate.",
      };
    }
  }

  if (registeredAddress && registeredAddress.trim() !== "") {
    const inputAddr = registeredAddress.trim().toUpperCase();
    const cacAddr = record.registeredAddress.trim().toUpperCase();
    if (!cacAddr.includes(inputAddr) && inputAddr !== cacAddr) {
      return {
        found: false,
        field: "registeredAddress",
        error:
          "Registered address does not match the CAC record. Use the exact address on your CAC certificate.",
      };
    }
  }

  return { found: true, error: null, cacDetails: record };
}
