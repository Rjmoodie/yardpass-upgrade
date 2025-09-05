import { useMemo } from 'react';

/**
 * Memoized selector hook for expensive computations
 */
export function useMemoizedSelector<T, R>(
  data: T,
  selector: (data: T) => R,
  deps: React.DependencyList = []
): R {
  return useMemo(() => {
    return selector(data);
  }, [data, ...deps]);
}

/**
 * Memoized array operations
 */
export function useMemoizedArray<T>(
  array: T[],
  transform?: (item: T, index: number) => T
): T[] {
  return useMemo(() => {
    if (!transform) return array;
    return array.map(transform);
  }, [array, transform]);
}

/**
 * Memoized filtered array
 */
export function useMemoizedFilter<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean
): T[] {
  return useMemo(() => {
    return array.filter(predicate);
  }, [array, predicate]);
}

/**
 * Memoized sorted array
 */
export function useMemoizedSort<T>(
  array: T[],
  compareFn?: (a: T, b: T) => number
): T[] {
  return useMemo(() => {
    return [...array].sort(compareFn);
  }, [array, compareFn]);
}
