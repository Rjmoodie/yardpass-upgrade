import { useEffect } from 'react';

export function PreconnectMux() {
  useEffect(() => {
    const links = [
      ['preconnect', 'https://stream.mux.com'],
      ['preconnect', 'https://image.mux.com'],
      ['dns-prefetch', 'https://stream.mux.com'],
      ['dns-prefetch', 'https://image.mux.com'],
    ].map(([rel, href]) => {
      const l = document.createElement('link');
      l.rel = rel;
      l.href = href;
      document.head.appendChild(l);
      return l;
    });
    return () => links.forEach(l => document.head.removeChild(l));
  }, []);
  return null;
}