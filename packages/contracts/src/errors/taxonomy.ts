/**
 * Error taxonomy shared across ingestion, API services, and downstream consumers.
 * Categories and codes map directly to validation and integrity guarantees derived from data/schema/combined-schema-reference.json.
 */
export const ErrorCategories = {
  Validation: "validation",
  Parse: "parse",
  ReferenceIntegrity: "reference_integrity",
  Infrastructure: "infrastructure"
} as const;

export type ErrorCategory = typeof ErrorCategories[keyof typeof ErrorCategories];

export const ErrorCodes = {
  ValidationSchemaMismatch: "validation.schema_mismatch",
  ValidationResponseShape: "validation.response_shape",
  ParseInvalidJson: "parse.invalid_json",
  ParseUnsupportedFormat: "parse.unsupported_format",
  ReferenceMissingCategory: "reference.missing_category",
  ReferenceMissingGroup: "reference.missing_group",
  ReferenceMissingMarketGroup: "reference.missing_market_group",
  ReferenceMissingMarketParent: "reference.missing_market_parent",
  ReferenceMissingMetaGroup: "reference.missing_meta_group",
  InfrastructureDatabase: "infrastructure.database_error",
  InfrastructureExternal: "infrastructure.external_dependency",
  InfrastructureMarketEmptyHistory: "infrastructure.market_empty_history",
  InfrastructureMarketNotFound: "infrastructure.market_not_found",
  InfrastructureMarketIngestionFailure: "infrastructure.market_ingestion_failure"
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface StructuredError {
  readonly category: ErrorCategory;
  readonly code: ErrorCode;
  readonly message: string;
  readonly schemaPath?: string;
  readonly context?: Record<string, unknown>;
  readonly cause?: unknown;
}

export function createStructuredError(error: StructuredError): StructuredError {
  return error;
}
