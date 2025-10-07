import { useEffect, useRef, useState } from 'react';

export function useCountdown(initial: number = 30) {
  const [seconds, setSeconds] = useState<number>(initial);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    intervalRef.current = window.setInterval(() => {
      setSeconds(s => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [seconds]);

  const reset = (n: number = initial) => setSeconds(n);
  return { seconds, reset, isRunning: seconds > 0 };
}

