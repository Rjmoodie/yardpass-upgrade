import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const html = document.documentElement;
  const isDark = resolvedTheme === "dark";

  const applyClassSafely = useCallback((mode: "light" | "dark" | "system") => {
    if (mode === "system") {
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      html.classList.toggle("dark", prefersDark);
    } else {
      html.classList.toggle("dark", mode === "dark");
    }
  }, [html]);

  const handleSystem = () => {
    setTheme("system");
    applyClassSafely("system");
  };

  const handleToggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    applyClassSafely(next);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleSystem}
        className={`pill-button ${theme === "system" ? "pill-button-active" : ""}`}
        aria-pressed={theme === "system"}
      >
        System
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={handleToggle}
        className="toggle-ios"
      >
        <span className="toggle-track" />
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}

