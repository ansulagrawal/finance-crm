import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './all-entities';

loadEnv({ path: `${__dirname}/../.env` });
loadEnv({ path: `${__dirname}/../../.env` });

export function buildDataSourceOptions(
  overrides: Partial<DataSourceOptions> = {},
): DataSourceOptions {
  return {
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'finance_crm_backend',
    charset: 'utf8mb4',
    // Legacy PK types include plain `bigint` (docs/SCHEMA-MAP.md: 24 of them) —
    // without this, mysql2 returns those as JS strings instead of numbers.
    extra: { supportBigNumbers: true, bigNumberStrings: false },
    entities: ALL_ENTITIES,
    synchronize: false,
    ...overrides,
  } as DataSourceOptions;
}

export const AppDataSource = new DataSource(buildDataSourceOptions());
