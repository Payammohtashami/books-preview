import { useId, useMemo, useState } from "react";
import { fillShells } from "./atoms";
import { toFa } from "@/lib/fa";
import { CircleCheck, CircleX } from "lucide-react";

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export interface BohrAtomData {
  /** برچسب زیر شکل (نشانه یا «الف») */
  label: string;
  p: number;
  n: number;
  /** تعداد الکترون؛ پیش‌فرض برابر p */
  e?: number;
}

/** مدل بور ثابت (بدون انیمیشن) شبیه شکل‌های کتاب: هسته‌ی فشرده و الکترون‌ها روی مدارها. */
export function BohrAtom({ p, n, e = p, className = "" }: { p: number; n: number; e?: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const total = p + n;
  const shells = fillShells(e);
  const k = shells.length;
  const nucR = total === 1 ? 8 : Math.min(28, 9 + 2.6 * Math.sqrt(total));
  const u = total === 1 ? 8 : nucR / (1.08 * Math.sqrt(total) + 1);
  const parts = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => {
        const r = total === 1 ? 0 : u * 1.08 * Math.sqrt(i + 0.5);
        const a = i * GOLDEN;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r, proton: Math.floor(((i + 1) * p) / total) > Math.floor((i * p) / total) };
      }),
    [total, p, u],
  );
  const radii = [nucR + 16, nucR + 16 + 26, nucR + 16 + 50].slice(0, Math.max(k, 1));
  const scale = Math.min(1, 92 / radii[radii.length - 1]);
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label={`${toFa(p)} پروتون، ${toFa(n)} نوترون و ${toFa(e)} الکترون`}>
      <defs>
        <radialGradient id={`${uid}p`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="45%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <radialGradient id={`${uid}n`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="45%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </radialGradient>
        <radialGradient id={`${uid}e`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
      </defs>
      <g transform={`translate(100 100) scale(${scale})`}>
        {shells.map((cnt, i) => {
          const r = radii[i];
          return (
            <g key={i}>
              <circle r={r} fill="none" stroke="#38bdf8" strokeWidth="1.4" strokeOpacity="0.8" />
              {Array.from({ length: cnt }, (_, j) => {
                const a = (j / cnt) * Math.PI * 2 + i * 0.9 + 0.5;
                return <circle key={j} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r="4.6" fill={`url(#${uid}e)`} />;
              })}
            </g>
          );
        })}
        {parts.map((q, i) => (
          <circle key={i} cx={q.x} cy={q.y} r={u} fill={`url(#${uid}${q.proton ? "p" : "n"})`} stroke="#0f172a" strokeOpacity="0.3" strokeWidth="0.3" />
        ))}
      </g>
    </svg>
  );
}

const panel = "overflow-hidden rounded-2xl border border-sky-900/40 bg-gradient-to-b from-slate-950 via-slate-900 to-[#0b1a33] p-3 text-white sm:p-4";

function Legend() {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-red-200 to-red-700" />پروتون</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-slate-100 to-slate-600" />نوترون</span>
      <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-sky-100 to-sky-700" />الکترون</span>
    </div>
  );
}

/** شکل ۲ کتاب: چند اتم کنار هم (مثلاً هیدروژن تا بور). */
export function BohrFigure({ atoms }: { atoms: BohrAtomData[] }) {
  return (
    <div className={panel}>
      <Legend />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {atoms.map((a) => (
          <div key={a.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-1.5 text-center">
            <BohrAtom p={a.p} n={a.n} e={a.e} className="mx-auto block w-full" />
            <p className="ltr text-lg font-bold" dir="ltr">{a.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ChoiceOption extends BohrAtomData {
  correct?: boolean;
  why: string;
}

/** پرسش «کدام ساختار درست است؟» با دو شکل و بازخورد. */
export function AtomChoice({ options }: { options: ChoiceOption[] }) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className={panel}>
      <Legend />
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const chosen = sel === o.label;
          const state = !chosen ? "" : o.correct ? "border-green-400 bg-green-400/10" : "border-red-400 bg-red-400/10";
          return (
            <button
              key={o.label}
              onClick={() => setSel(o.label)}
              aria-pressed={chosen}
              className={`rounded-xl border p-2 text-center transition ${state || "border-white/10 bg-white/[0.03] hover:border-sky-400/60"}`}
            >
              <BohrAtom p={o.p} n={o.n} e={o.e} className="mx-auto block w-full max-w-[14rem]" />
              <p className="text-lg font-bold">{o.label})</p>
              {chosen && (
                <p className="mt-1 text-start text-[13px] leading-7 text-slate-200">
                  {o.correct ? <CircleCheck className="me-1 inline size-4 text-green-400" aria-hidden="true" /> : <CircleX className="me-1 inline size-4 text-red-400" aria-hidden="true" />}
                  {o.why}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
