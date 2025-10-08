const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export function readLocalStorage(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('[safeStorage] Failed to read key', key, error);
    return null;
  }
}

export function writeLocalStorage(key: string, value: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('[safeStorage] Failed to write key', key, error);
  }
}

export function removeLocalStorage(key: string) {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn('[safeStorage] Failed to remove key', key, error);
  }
}
