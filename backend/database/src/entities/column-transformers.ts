import type { ValueTransformer } from 'typeorm';

/**
 * Legacy stores flags as `tinyint unsigned`, not as TypeORM's `boolean`
 * (which is `tinyint(1)` and would make every entity want to `MODIFY` a live
 * column). Map the real column type and convert at the edge so entity
 * properties stay `boolean` and no service code changes.
 *
 * Many legacy flag columns are nullable with a `DEFAULT 0`; a null there means
 * "not set", which for an active/deleted/sourcing flag is false. Reading it
 * back as `false` rather than `null` keeps the property honestly `boolean`.
 */
export const tinyintBoolean: ValueTransformer = {
  to: (value: boolean | null | undefined) =>
    value == null ? value : value ? 1 : 0,
  from: (value: number | null) => value != null && value !== 0,
};

/**
 * For legacy columns held as a number where the domain value is really a
 * fixed-width string — `master_pincode.m_pincode_value` is `mediumint
 * unsigned`, but every DTO and service treats a pincode as a string.
 */
export const numericString: ValueTransformer = {
  to: (value: string | null | undefined) =>
    value == null || value === '' ? null : Number(value),
  from: (value: number | null) => (value == null ? null : String(value)),
};
