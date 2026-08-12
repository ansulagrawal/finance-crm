import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import { ApiCallStatus, LeadCustomer, PoiVerificationLog } from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

/**
 * Ports `updateFatherName()` from `CronMiscellaneousController.php` — backfills
 * `lead_customer.father_name` from the father's name Signzy already returned
 * in a successful PAN-fetch response, for customers whose profile record
 * doesn't have it yet.
 *
 * Legacy read raw `api_poi_verification_logs` rows
 * (`poi_veri_method_id=1 AND poi_veri_api_status_id=1 AND poi_veri_active=1`),
 * JSON-decoded `poi_veri_response`, pulled `response.result.fatherName`, and
 * wrote it to both `lead_customer.father_name` and back onto the log row
 * itself (`poi_veri_father_name`). This port's equivalent log entity,
 * `PoiVerificationLog` (`integrations-api`'s `poi-verification` module,
 * `method` 1 = PAN fetch), already captures `fatherName` directly into its
 * own column at write time — so the "write it back onto the log row" half
 * of legacy's job is redundant here and not reproduced; only the
 * profile-backfill half applies.
 *
 * **Deliberate deviation from legacy**: legacy's SQL has no filter on
 * whether `lead_customer.father_name` is already set, and no "already
 * processed" tracking column at all — every run re-updates every matching
 * customer unconditionally, forever. That's harmless for a value that's
 * always re-derived identically, but it does mean a manually-corrected
 * `father_name` gets silently clobbered back to the PAN response's value on
 * the next run. This port instead only backfills customers whose
 * `fatherName` is currently `NULL`, a safer interpretation of "backfill"
 * that still fully covers the stated intent (populate a missing field from
 * verification data already on file) without the blind-overwrite risk.
 *
 * When a lead has more than one successful PAN-fetch log, the most
 * recently-created one wins (ties with legacy's implicit last-write-wins
 * behavior, since legacy iterated rows in ascending `poi_veri_id` order
 * with no ORDER BY override).
 *
 * **Scheduling**: legacy uses a fixed daily wall-clock cutoff
 * (`intval(date("Hi")) > 1355`, i.e. "only run before 13:55") rather than
 * the 30-minute `cron_scheduler_logs` dedup guard used elsewhere in this
 * controller — same "single daily window" cadence signal used to schedule
 * `CronEmailerController`'s methods once daily. This port runs once daily,
 * at a time safely before that cutoff.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_POI_FATHER_NAME_SYNC` is set to a real cron expression.
 */
@Injectable()
export class PoiFatherNameSyncService implements OnModuleInit {
  private readonly logger = new Logger(PoiFatherNameSyncService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  /** Legacy's `poi_veri_method_id=1` — PAN fetch (`v3/pan/fetchV2`). */
  private static readonly PAN_FETCH_METHOD_ID = 1;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(PoiVerificationLog)
    private readonly poiLogRepository: Repository<PoiVerificationLog>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'poi-father-name-sync',
      PoiFatherNameSyncService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ updated: number }> {
    const logs = await this.poiLogRepository.find({
      where: {
        method: PoiFatherNameSyncService.PAN_FETCH_METHOD_ID,
        status: ApiCallStatus.SUCCESS,
        fatherName: Not(IsNull()),
      },
      relations: { lead: true },
      order: { id: 'ASC' },
    });
    if (logs.length === 0) {
      this.logger.debug('poi-father-name-sync: no successful PAN-fetch logs');
      return { updated: 0 };
    }

    // Ascending order + overwrite-on-iterate means the highest-id (most
    // recent) log per lead is what remains in the map.
    const fatherNameByLeadId = new Map<number, string>();
    for (const log of logs) {
      if (!log.fatherName) continue;
      fatherNameByLeadId.set(log.lead.id, log.fatherName.trim().toUpperCase());
    }

    const customers = await this.leadCustomerRepository.find({
      where: {
        lead: { id: In([...fatherNameByLeadId.keys()]) },
        fatherName: IsNull(),
      },
      relations: { lead: true },
    });
    if (customers.length === 0) {
      this.logger.debug(
        'poi-father-name-sync: no customers with a missing father name to backfill',
      );
      return { updated: 0 };
    }

    let updated = 0;
    for (const customer of customers) {
      const fatherName = fatherNameByLeadId.get(customer.lead.id);
      if (!fatherName) continue;
      customer.fatherName = fatherName;
      await this.leadCustomerRepository.save(customer);
      updated += 1;
    }

    this.logger.log(`poi-father-name-sync: updated=${updated}`);
    return { updated };
  }
}
