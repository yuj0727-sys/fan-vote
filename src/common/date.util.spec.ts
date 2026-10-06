import { getTodayInSeoul } from './date.util.js';

describe('getTodayInSeoul', () => {
  it('UTC 2026-01-01T16:00:00Z는 서울 기준 2026-01-02다', () => {
    expect(getTodayInSeoul(new Date('2026-01-01T16:00:00Z'))).toBe(
      '2026-01-02',
    );
  });

  it('UTC 2026-01-01T14:59:00Z는 서울 기준 2026-01-01이다', () => {
    expect(getTodayInSeoul(new Date('2026-01-01T14:59:00Z'))).toBe(
      '2026-01-01',
    );
  });
});
