// src/lib/seriesUtils.ts
import { RecurrencePattern } from '@/types/series';

export function computeOccurrences(
  recurrence: RecurrencePattern,
  interval: number,
  seriesStartISO: string,
  seriesEndDate: string,
  maxEvents?: number
): string[] {
  const out: string[] = [];
  const start = new Date(seriesStartISO);
  const endDate = new Date(seriesEndDate + 'T23:59:59Z'); // inclusive end
  const stepWeeks = Math.max(1, interval);

  let cursor = new Date(start);
  while (cursor <= endDate) {
    out.push(cursor.toISOString());
    if (maxEvents && out.length >= maxEvents) break;

    if (recurrence === 'weekly') {
      cursor.setUTCDate(cursor.getUTCDate() + 7 * stepWeeks);
    } else {
      // monthly
      const m = cursor.getUTCMonth();
      cursor.setUTCMonth(m + Math.max(1, interval));
    }
  }
  return out;
}