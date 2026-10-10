import React, { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className = "" }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [open]);

  const options = [
    { value: "system", label: "System", Icon: Monitor },
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon }
  ];
  const current = options.find((o) => o.value === theme) || options[0];
  const CurrentIcon = current.Icon;

  return (
    <div className={cn("relative", className)} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-transparent text-foreground transition-colors hover:bg-accent"
        title={`Theme: ${current.label}`}
        aria-label="Toggle theme"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {options.map((o) => {
            const Icon = o.Icon;
            return (
              <button
                key={o.value}
                onClick={() => { setTheme(o.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  theme === o.value && "bg-accent font-medium"
                )}
              >
                <Icon className="h-4 w-4" />
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}