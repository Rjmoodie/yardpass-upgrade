"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  // Avoid hydration mismatch
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-3">
      {/* System button (pill) */}
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`pill-button ${theme === "system" ? "pill-button-active" : ""}`}
        aria-pressed={theme === "system"}
      >
        System
      </button>

      {/* iOS switch to force dark/light */}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="toggle-ios"
      >
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
