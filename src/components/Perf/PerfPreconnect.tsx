export function PerfPreconnect() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return (
    <>
      {/* Supabase */}
      <link rel="preconnect" href={supabaseUrl} crossOrigin="" />
      <link rel="dns-prefetch" href={supabaseUrl} />
      {/* Mux */}
      <link rel="preconnect" href="https://stream.mux.com" crossOrigin="" />
      <link rel="dns-prefetch" href="https://stream.mux.com" />
      {/* Fonts (if you use Google Fonts) */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    </>
  );
}