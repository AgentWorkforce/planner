import React, { createContext, useContext, useEffect, useState } from "react";
import { SunIcon, MoonIcon, MonitorIcon } from "../icons";
import { cn } from "../utils/cn";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Default theme (default: "system") */
  defaultTheme?: Theme;
  /** LocalStorage key for persistence (default: "theme") */
  storageKey?: string;
  /** Attribute to set on document element (default: "class") */
  attribute?: "class" | "data-theme";
}

/**
 * Theme provider with system preference detection and persistence.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  attribute = "class",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as Theme | null;
      return stored ?? defaultTheme;
    }
    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (newTheme: "light" | "dark") => {
      if (attribute === "class") {
        root.classList.remove("light", "dark");
        root.classList.add(newTheme);
      } else {
        root.setAttribute("data-theme", newTheme);
      }
      setResolvedTheme(newTheme);
    };

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mediaQuery.matches ? "dark" : "light");

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? "dark" : "light");
      };

      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      applyTheme(theme);
      return undefined;
    }
  }, [theme, attribute]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access and modify the current theme.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export interface ThemeToggleProps {
  /** Show labels alongside icons */
  showLabels?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Theme toggle button with light/dark/system options.
 */
export function ThemeToggle({ showLabels = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <SunIcon size={16} />, label: "Light" },
    { value: "dark", icon: <MoonIcon size={16} />, label: "Dark" },
    { value: "system", icon: <MonitorIcon size={16} />, label: "System" },
  ];

  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-lg bg-muted", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setTheme(option.value)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
            theme === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={`Set theme to ${option.label}`}
        >
          {option.icon}
          {showLabels && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}
