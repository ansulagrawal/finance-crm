import {
  ALLOCATION_WORKING_HOURS,
  isWithinHhmmWindow,
} from './working-hours.util';

describe('isWithinHhmmWindow', () => {
  it('is false before the window opens', () => {
    const now = new Date(2026, 0, 1, 8, 59);
    expect(
      isWithinHhmmWindow(
        now,
        ALLOCATION_WORKING_HOURS.start,
        ALLOCATION_WORKING_HOURS.end,
      ),
    ).toBe(false);
  });

  it('is true right at the window open (09:00)', () => {
    const now = new Date(2026, 0, 1, 9, 0);
    expect(
      isWithinHhmmWindow(
        now,
        ALLOCATION_WORKING_HOURS.start,
        ALLOCATION_WORKING_HOURS.end,
      ),
    ).toBe(true);
  });

  it('is true right at the window close (23:30)', () => {
    const now = new Date(2026, 0, 1, 23, 30);
    expect(
      isWithinHhmmWindow(
        now,
        ALLOCATION_WORKING_HOURS.start,
        ALLOCATION_WORKING_HOURS.end,
      ),
    ).toBe(true);
  });

  it('is false after the window closes', () => {
    const now = new Date(2026, 0, 1, 23, 31);
    expect(
      isWithinHhmmWindow(
        now,
        ALLOCATION_WORKING_HOURS.start,
        ALLOCATION_WORKING_HOURS.end,
      ),
    ).toBe(false);
  });
});
