import { cn } from "@/lib/utils";

export const STAT_TONES: Record<string, string> = {
  slate: "bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/30",
  blue: "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/30",
  violet: "bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/30",
  amber: "bg-gradient-to-br from-amber-400 to-amber-500 shadow-amber-500/30",
  emerald: "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30",
  red: "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30",
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
    <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className={cn("absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-[0.07] blur-sm", STAT_TONES[tone])} />
      <div className={cn("relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-lg", STAT_TONES[tone])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="relative mt-3">
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
