import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { updateStatusBarForTheme } from "@/lib/ios-capacitor";
import { useEffect } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // ✅ Update iOS StatusBar when theme changes
  useEffect(() => {
    if (theme) {
      const isDark = theme === 'dark';
      updateStatusBarForTheme(isDark).catch(console.error);
    }
  }, [theme]);

  const handleToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    // ✅ Immediately update StatusBar for iOS
    updateStatusBarForTheme(newTheme === 'dark').catch(console.error);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="relative"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}
