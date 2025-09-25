import React from 'react';

export function PerfPreconnect() {
  return (
    <>
      {/* Supabase */}
      <link rel="preconnect" href="https://yieslxnrfeqchbcmgavz.supabase.co" crossOrigin="" />
      <link rel="dns-prefetch" href="https://yieslxnrfeqchbcmgavz.supabase.co" />
      {/* Mux */}
      <link rel="preconnect" href="https://stream.mux.com" crossOrigin="" />
      <link rel="dns-prefetch" href="https://stream.mux.com" />
      <link rel="preconnect" href="https://image.mux.com" crossOrigin="" />
      <link rel="dns-prefetch" href="https://image.mux.com" />
      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    </>
  );
}