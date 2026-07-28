import { Transform, instanceToPlain } from 'class-transformer';

/**
 * Shared status enum mirroring the legacy convention seen across every
 * `api_*_logs` table (`api_status_id`: 1=success, 2=API-returned-error,
 * 3=network/curl error, 4=validation/precondition error before the call
 * was even made).
 */
export enum ApiCallStatus {
  PENDING = 0,
  SUCCESS = 1,
  API_ERROR = 2,
  NETWORK_ERROR = 3,
  VALIDATION_ERROR = 4,
}

/**
 * TypeORM loads this column as the raw numeric enum value, but every
 * frontend consumer types it as the string key (e.g. `status === 'SUCCESS'`)
 * and every comparison silently fails against the number — the vendor-call
 * UI (PAN/bureau/bank/eKYC/eSign/etc.) showed every result as failed
 * regardless of the real outcome. Converts to the string key at the HTTP
 * response boundary only (`toPlainOnly`) — the numeric value TypeORM/service
 * code works with internally is untouched.
 */
export const SerializeApiCallStatus = () =>
  Transform(
    ({ value }) =>
      typeof value === 'number' ? (ApiCallStatus[value] ?? value) : value,
    { toPlainOnly: true },
  );

if (require.main === module) {
  class Probe {
    @SerializeApiCallStatus()
    status: number = ApiCallStatus.SUCCESS;
  }
  const probe = new Probe();
  console.assert(
    instanceToPlain(probe).status === 'SUCCESS',
    'numeric enum value should serialize to its string key',
  );
  probe.status = 99;
  console.assert(
    instanceToPlain(probe).status === 99,
    'unknown numeric value should pass through unchanged',
  );
  console.assert(
    probe.status === 99,
    'in-memory value must stay numeric — only the serialized copy changes',
  );
  console.log('SerializeApiCallStatus: ok');
}
