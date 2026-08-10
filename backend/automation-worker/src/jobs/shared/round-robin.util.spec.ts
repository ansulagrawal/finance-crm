import { allocateRoundRobin } from './round-robin.util';

describe('allocateRoundRobin', () => {
  it('assigns each lead to the currently least-loaded candidate', () => {
    const assignments = allocateRoundRobin(
      [1, 2, 3],
      [
        { userId: 10, currentLoad: 5 },
        { userId: 20, currentLoad: 0 },
      ],
      10,
      10,
    );

    // lead 1 -> user 20 (load 0 < 5); after that user 20's in-run load is 1,
    // so lead 2 -> user 10 (load 5 < 1? no: 5 vs 1 -> user 20 still lower at 1)
    expect(assignments.get(1)).toBe(20);
    expect(assignments.get(2)).toBe(20);
    expect(assignments.get(3)).toBe(20);
  });

  it('spreads leads once a candidate hits its per-run cap', () => {
    const assignments = allocateRoundRobin(
      [1, 2, 3],
      [
        { userId: 10, currentLoad: 0 },
        { userId: 20, currentLoad: 0 },
      ],
      1,
      10,
    );

    const values = [...assignments.values()];
    expect(values).toContain(10);
    expect(values).toContain(20);
    expect(assignments.size).toBe(2);
  });

  it('stops once maxTotalThisRun is reached, leaving remaining leads unassigned', () => {
    const assignments = allocateRoundRobin(
      [1, 2, 3, 4],
      [{ userId: 10, currentLoad: 0 }],
      10,
      2,
    );

    expect(assignments.size).toBe(2);
    expect(assignments.has(3)).toBe(false);
    expect(assignments.has(4)).toBe(false);
  });

  it('returns an empty map when there are no eligible candidates', () => {
    const assignments = allocateRoundRobin([1, 2], [], 10, 10);
    expect(assignments.size).toBe(0);
  });

  it('returns an empty map when there are no leads to assign', () => {
    const assignments = allocateRoundRobin(
      [],
      [{ userId: 10, currentLoad: 0 }],
      10,
      10,
    );
    expect(assignments.size).toBe(0);
  });
});
