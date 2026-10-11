import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

const ThemeContext = createContext(null);
const STORAGE_KEY = "perk-theme";

function getSystemPreference() {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark" || (theme === "system" && getSystemPreference() === "dark");
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
}

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState(() => (typeof window === "undefined" ? "system" : localStorage.getItem(STORAGE_KEY) || "system"));
  const syncedRef = useRef(false);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Adopt the account's saved preference once, or push the local choice up.
  useEffect(() => {
    if (syncedRef.current || !user) return;
    syncedRef.current = true;
    const acct = user.theme_preference;
    if (acct && acct !== theme) {
      setThemeState(acct);
    } else if (!acct) {
      base44.auth.updateMe({ theme_preference: theme }).catch(() => {});
    }
  }, [user]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    if (user) base44.auth.updateMe({ theme_preference: t }).catch(() => {});
  }, [user]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
