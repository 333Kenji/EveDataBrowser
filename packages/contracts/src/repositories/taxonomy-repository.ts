import type { Pool } from "pg";
import type { TaxonomyCategoryNode, TaxonomyTypeSummary } from "../domain/taxonomy.js";
import { RepositoryError } from "./errors.js";

export interface TaxonomyHierarchyOptions {
  readonly includeUnpublished?: boolean;
  readonly minimumTypeCount?: number;
}

export interface TaxonomySearchFilters {
  readonly categoryIds?: readonly number[];
  readonly groupIds?: readonly number[];
  readonly metaGroupIds?: readonly number[];
  readonly publishedOnly?: boolean;
}

export interface TaxonomySearchOptions {
  readonly query?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly filters?: TaxonomySearchFilters;
}

export interface TaxonomyRepository {
  listHierarchy(options?: TaxonomyHierarchyOptions): Promise<ReadonlyArray<TaxonomyCategoryNode>>;
  searchTypes(options: TaxonomySearchOptions): Promise<ReadonlyArray<TaxonomyTypeSummary>>;
}

export type TaxonomyRepositoryFactory = (pool: Pool) => TaxonomyRepository;

export function assertRepositoryContract(contract: unknown): asserts contract is TaxonomyRepository {
  if (!contract || typeof (contract as TaxonomyRepository).listHierarchy !== "function") {
    throw new RepositoryError("Provided taxonomy repository does not implement listHierarchy()");
  }
  if (typeof (contract as TaxonomyRepository).searchTypes !== "function") {
    throw new RepositoryError("Provided taxonomy repository does not implement searchTypes()");
  }
}
