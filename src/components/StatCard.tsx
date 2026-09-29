import { cn } from "@/lib/utils";

export const STAT_TONES: Record<string, string> = {
  slate: "bg-slate-50 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-500",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "slate",
  sub,
  note,
  loading,
  raw,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone?: keyof typeof STAT_TONES;
  sub?: string;
  note?: string;
  loading?: boolean;
  raw?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", STAT_TONES[tone])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
        ) : (
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {raw || typeof value === "string" ? value : value.toLocaleString()}
          </div>
        )}
        <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
          {label}
          {note && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 text-[9px] font-semibold uppercase">
              {note}
            </span>
          )}
        </div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
