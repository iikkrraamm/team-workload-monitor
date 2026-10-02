import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Light / dark theme.
//
// The choice is remembered in the browser (localStorage), the same way the
// Kanban / List choice on the Tasks page is. Until the user picks one the app
// follows the operating system and keeps following it if it changes.
// index.html applies the same decision before the first paint; the key and
// the fallback there must stay in step with this file.

export const THEME_STORAGE_KEY = "app-theme";
const THEME_COLORS = { light: "#F5F5F7", dark: "#0E0E10" }; // browser UI tint on phones

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    // Storage blocked (private mode, policy): fine, just nothing to remember.
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

const ThemeContext = createContext({ theme: "light", isDark: false, setTheme: () => {}, toggleTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme() ?? systemTheme());
  // Once the user has chosen, the OS setting no longer overrides it.
  const [explicit, setExplicit] = useState(() => readStoredTheme() !== null);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    if (explicit || !window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => setThemeState(e.matches ? "dark" : "light");
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [explicit]);

  // Another tab changed the choice.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = e.newValue === "light" || e.newValue === "dark" ? e.newValue : null;
      if (next) {
        setThemeState(next);
        setExplicit(true);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    setExplicit(true);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Not remembered next time, but the switch still works for this session.
    }
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
