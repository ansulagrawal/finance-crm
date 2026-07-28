import * as entities from './index';

/**
 * Every TypeORM entity class exported from `./index`, filtered out of the
 * barrel export's namespace object. Used by `data-source.ts` (migrations)
 * and by services whose modules legitimately touch most of the schema
 * (e.g. `reporting-api`'s MIS reports/CSV exports cut across nearly every
 * domain) — registering the full set once in one `CommonModule` avoids the
 * "Entity metadata for X was not found" boot crash that comes from
 * TypeORM's `autoLoadEntities` only picking up entities some module
 * explicitly registers via `forFeature`.
 */
export const ALL_ENTITIES = Object.values(entities).filter(
  (value) => typeof value === 'function',
) as Array<new (...args: never) => unknown>;
