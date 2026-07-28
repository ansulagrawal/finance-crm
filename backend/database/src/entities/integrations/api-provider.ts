/**
 * Legacy `master_api_provider`, which every `api_*_logs` table's `*_provider`
 * column keys against as a `tinyint`.
 *
 * This replaces the provider *name strings* (`'digitap'`, `'signzy'`) that the
 * integration services previously wrote. Legacy speaks in ids, the app-server
 * install reads the same columns, and those columns are NOT NULL — so the
 * numeric vocabulary is the shared one.
 *
 * Mirrors the `ApiCallStatus` pattern in this folder: a numeric enum standing
 * in for a legacy id column, stored as the integer legacy already uses.
 */
export enum ApiProvider {
  SIGNZY = 1,
  DIGITAP = 2,
}
