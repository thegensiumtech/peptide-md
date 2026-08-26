/**
 * Single response envelope for every endpoint. The static data client returns
 * these today; the Express API returns the identical shape later, so screens
 * never change when the data source is swapped.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  data: null;
  error: string;
  /**
   * Machine-readable reason, e.g. 'SLOT_TAKEN'. The API has always sent this
   * for expected failures; the type simply did not admit it. Partners branch on
   * it, so it is part of the contract rather than a detail.
   */
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, meta?: PaginationMeta): ApiSuccess<T> {
  return meta ? { success: true, data, error: null, meta } : { success: true, data, error: null };
}

export function fail(error: string): ApiFailure {
  return { success: false, data: null, error };
}
