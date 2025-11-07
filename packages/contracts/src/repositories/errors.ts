export class RepositoryError extends Error {
  override readonly name = "RepositoryError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export function wrapRepositoryError(context: string, error: unknown): RepositoryError {
  if (error instanceof RepositoryError) {
    return error;
  }
  const details = error instanceof Error ? error.message : String(error);
  return new RepositoryError(`${context}: ${details}`, { cause: error });
}
