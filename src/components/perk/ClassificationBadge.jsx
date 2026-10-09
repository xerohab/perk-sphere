import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";

const CONFIG = {
  allowed: { label: "Allowed", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  disallowed: { label: "Disallowed", icon: XCircle, className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
  neutral: { label: "Neutral", icon: MinusCircle, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" }
};

export default function ClassificationBadge({ classification, size = "sm" }) {
  const config = CONFIG[classification] || CONFIG.neutral;
  const Icon = config.icon;
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.className} ${sizeClass}`}>
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {config.label}
    </span>
  );
}