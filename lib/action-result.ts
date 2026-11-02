// Uniform return shape for Server Actions so forms can show field-level
// validation messages (NFR-24) without exposing internal errors (NFR-21).

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      code?: string;
      details?: unknown;
      /** Non-secret submitted values, so forms keep them after React resets the form. */
      values?: Record<string, string>;
    };

export type FormState = ActionResult | null;
