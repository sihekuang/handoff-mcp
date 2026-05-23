// lib/handoffs/errors.ts
export type HandoffErrorKind =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "unauthorized";

export class HandoffError extends Error {
  public readonly kind: HandoffErrorKind;
  public readonly meta?: Record<string, unknown>;

  constructor(kind: HandoffErrorKind, detail: string, meta?: Record<string, unknown>) {
    super(detail);
    this.name = "HandoffError";
    this.kind = kind;
    this.meta = meta;
  }
}

export function isHandoffError(e: unknown): e is HandoffError {
  return e instanceof HandoffError;
}
