import type { ZodTypeAny } from "zod";

/**
 * Runtime validation helper intended for API/web response shaping in development environments.
 * When NODE_ENV !== "production" (or CONTRACTS_VALIDATE_RUNTIME === "always"), the provided schema is used
 * to verify the payload; otherwise the payload is returned untouched.
 */
export function validateWithSchema<T>(schema: ZodTypeAny, payload: T, label?: string): T {
  if (!shouldValidate()) {
    return payload;
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    const messagePrefix = label ? `Contract validation failed for ${label}` : "Contract validation failed";
    const error = new Error(`${messagePrefix}: ${result.error.message}`, { cause: result.error });
    throw error;
  }

  return payload;
}

function shouldValidate(): boolean {
  const mode = process.env.CONTRACTS_VALIDATE_RUNTIME ?? "auto";
  if (mode === "always") {
    return true;
  }
  if (mode === "never") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}
