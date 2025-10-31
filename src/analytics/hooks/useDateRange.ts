// Analytics V2 - Date Range Hook

import { useMemo, useState } from 'react';
import type { DateRange } from '../api/types';

/**
 * Hook for managing analytics date range
 * Returns ISO date strings (yyyy-mm-dd) for querying
 */
export function useDateRange(defaultDays = 7) {
  const [days, setDays] = useState(defaultDays);

  const range = useMemo<DateRange>(() => {
    const to = new Date();
    const from = new Date(Date.now() - days * 86400000); // days * 24h * 60m * 60s * 1000ms

    return {
      from: from.toISOString().slice(0, 10), // yyyy-mm-dd
      to: to.toISOString().slice(0, 10),
    };
  }, [days]);

  return { range, days, setDays };
}



