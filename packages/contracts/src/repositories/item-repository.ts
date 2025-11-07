import type { Pool } from "pg";
import type { TypeDetail } from "../domain/items.js";
import { RepositoryError } from "./errors.js";

export interface GetTypeDetailParams {
  readonly typeId: number;
}

export interface ItemRepository {
  getTypeDetail(params: GetTypeDetailParams): Promise<TypeDetail | null>;
}

export type ItemRepositoryFactory = (pool: Pool) => ItemRepository;

export function assertItemRepository(contract: unknown): asserts contract is ItemRepository {
  if (!contract || typeof (contract as ItemRepository).getTypeDetail !== "function") {
    throw new RepositoryError("Provided item repository does not implement getTypeDetail()");
  }
}
