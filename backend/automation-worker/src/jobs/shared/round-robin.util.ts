/**
 * Generalizes the round-robin "assign to whoever currently has the fewest
 * leads, re-sort, repeat" pattern used by every allocation method in
 * `CronSanctionController.php` (`usort($master_user_lead, ...)` before the
 * loop, re-sorted after each assignment).
 *
 * Legacy used two different sort keys across near-identical methods
 * (`inprocess_leads+assigned` vs `total_today_process_leads+assigned` vs
 * plain `count+assigned`) and tracked "today's" allocations via a separate
 * `user_lead_allocation_log` table this schema doesn't have. This port
 * normalizes on a single, explicit `currentLoad` (the caller decides what
 * that means — see each job service's query) plus an in-run counter, which
 * is a deliberate simplification: documented in TODO.md rather than
 * replicating the legacy inconsistency.
 */
export interface AllocationCandidate {
  userId: number;
  currentLoad: number;
}

/**
 * Greedily assigns each lead id to the least-loaded eligible candidate,
 * capping both how many a single user can receive in this run
 * (`maxPerUserThisRun`, ports `cronLimit`) and how many leads are processed
 * in total (`maxTotalThisRun`, ports `bucketSize`). Returns a leadId ->
 * userId map in assignment order.
 */
export function allocateRoundRobin(
  leadIds: number[],
  candidates: AllocationCandidate[],
  maxPerUserThisRun: number,
  maxTotalThisRun: number,
): Map<number, number> {
  const assignments = new Map<number, number>();
  if (candidates.length === 0) return assignments;

  const pool = candidates.map((c) => ({ ...c, assignedThisRun: 0 }));

  for (const leadId of leadIds) {
    if (assignments.size >= maxTotalThisRun) break;

    pool.sort(
      (a, b) =>
        a.currentLoad + a.assignedThisRun - (b.currentLoad + b.assignedThisRun),
    );
    const candidate = pool.find((c) => c.assignedThisRun < maxPerUserThisRun);
    if (!candidate) break;

    assignments.set(leadId, candidate.userId);
    candidate.assignedThisRun += 1;
  }

  return assignments;
}
