import { useId, useMemo, useState } from "react";
import { toFa } from "@/lib/fa";

interface AtomDef {
  sym: string;
  name: string;
  z: number;
  n: number;
  /** تعداد الکترون هر لایه */
  shells: number[];
  /** شعاع کل اتم در بوم ۲۰۰×۲۰۰ */
  R: number;
  /** شعاع هر ذره‌ی هسته */
  u: number;
}

const ATOMS: AtomDef[] = [
  { sym: "H", name: "هیدروژن", z: 1, n: 0, shells: [1], R: 52, u: 7 },
  { sym: "C", name: "کربن", z: 6, n: 6, shells: [2, 4], R: 74, u: 4.2 },
  { sym: "U", name: "اورانیم", z: 92, n: 146, shells: [2, 8, 18, 32, 21, 9, 2], R: 97, u: 1.45 },
];

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** چیدمان گلِ آفتابگردان: در حالت پیش‌فرض ذره‌ها به هم می‌چسبند. */
function nucleus(p: number, n: number, u: number) {
  const total = p + n;
  const gap = u * 1.08;
  return Array.from({ length: total }, (_, i) => {
    const r = total === 1 ? 0 : gap * Math.sqrt(i + 0.5);
    const a = i * GOLDEN;
    // پخش یکنواخت پروتون و نوترون در ترتیب چیدمان
    const proton = Math.floor(((i + 1) * p) / total) > Math.floor((i * p) / total);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, proton };
  });
}

const SPREAD = 1.85;

function AtomSvg({ a, active, open, motion }: { a: AtomDef; active: boolean; open: boolean; motion: boolean }) {
  const uid = useId().replace(/:/g, "");
  const parts = useMemo(() => nucleus(a.z, a.n, a.u), [a]);
  const nucR = Math.max(...parts.map((q) => Math.hypot(q.x, q.y))) + a.u;
  const k = a.shells.length;
  const spread = parts.length > 1 ? SPREAD : 1;
  // مدار اول بیرون از هسته‌ی بازشده قرار می‌گیرد
  const inner = Math.max(nucR * spread + (k > 3 ? 5 : 8), 14);
  const radii = a.shells.map((_, i) => (k === 1 ? a.R - 8 : inner + ((a.R - 8 - inner) * i) / (k - 1)));

  return (
    <svg viewBox="0 0 200 200" className="mx-auto block w-full max-w-[17rem]" role="img" aria-label={`اتم ${a.name}`}>
      <defs>
        <radialGradient id={`${uid}cloud`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity={active ? 0.28 : 0.16} />
          <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
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
        <radialGradient id={`${uid}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="100" cy="100" r={a.R} fill={`url(#${uid}cloud)`} />
      <circle cx="100" cy="100" r={nucR * (open ? spread : 1) + 16} fill={`url(#${uid}glow)`} />

      {radii.map((r, i) => {
        const e = a.shells[i];
        const dur = 7 + i * 4.5 + (k > 3 ? i * 1.5 : 0);
        return (
          <g key={i}>
            <circle cx="100" cy="100" r={r} fill="none" stroke="#7dd3fc" strokeOpacity={k > 3 ? 0.35 : 0.5} strokeWidth="0.9" strokeDasharray={k > 3 ? "1.5 2.5" : undefined} />
            <g style={motion ? { transformOrigin: "100px 100px", animation: `atom-spin ${dur}s linear infinite${i % 2 ? " reverse" : ""}` } : undefined}>
              {Array.from({ length: e }, (_, j) => {
                const ang = (j / e) * Math.PI * 2 + i * 0.7;
                const er = k > 3 ? 1.7 : 4;
                return <circle key={j} cx={100 + Math.cos(ang) * r} cy={100 + Math.sin(ang) * r} r={er} fill={`url(#${uid}e)`} />;
              })}
            </g>
          </g>
        );
      })}

      <g transform="translate(100 100)">
        {parts.map((q, i) => (
          <circle
            key={i}
            r={a.u}
            fill={`url(#${uid}${q.proton ? "p" : "n"})`}
            stroke="#0f172a"
            strokeOpacity="0.35"
            strokeWidth={a.u > 2 ? 0.3 : 0.12}
            style={{
              transform: `translate(${q.x * (open ? spread : 1)}px, ${q.y * (open ? spread : 1)}px)`,
              transition: "transform 650ms cubic-bezier(.2,.8,.2,1)",
              transitionDelay: `${(i % 7) * 18}ms`,
            }}
          />
        ))}
      </g>
    </svg>
  );
}

const stat = (label: string, v: number, dot: string) => (
  <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[13px]">
    <span className="inline-flex items-center gap-1.5 text-slate-300">
      <span className={`size-2.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
    <span className="font-bold tabular-nums text-white">{toFa(v)}</span>
  </div>
);

/** شکل ۱ کتاب: مقایسه‌ی ساختار هیدروژن، کربن و اورانیم (اندازه‌ها فرضی و نسبی). */
export default function AtomCompare() {
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const motion = useMemo(() => !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  return (
    <div className="overflow-hidden rounded-3xl border border-sky-900/40 bg-gradient-to-b from-slate-950 via-slate-900 to-[#0b1a33] p-3 text-white shadow-xl sm:p-5">
      <style>{`@keyframes atom-spin{to{transform:rotate(360deg)}}`}</style>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-red-200 to-red-700" />پروتون</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-slate-100 to-slate-600" />نوترون</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-sky-100 to-sky-700" />الکترون</span>
        <span className="ms-auto opacity-70">نشانگر را روی اتم ببرید یا بزنید تا هسته باز شود</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {ATOMS.map((a) => {
          const active = sel === a.sym;
          const open = active || hover === a.sym;
          return (
            <button
              key={a.sym}
              onMouseEnter={() => setHover(a.sym)}
              onMouseLeave={() => setHover((h) => (h === a.sym ? null : h))}
              onClick={() => setSel(active ? null : a.sym)}
              aria-pressed={active}
              className={`group rounded-2xl border p-3 text-start transition ${active ? "border-sky-400 bg-sky-400/10 ring-2 ring-sky-400/40" : "border-white/10 bg-white/[0.03] hover:border-sky-400/60"}`}
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className="ltr text-3xl font-black tracking-tight" dir="ltr">
                  <sub className="me-1 align-baseline text-sm font-semibold text-red-300">{toFa(a.z)}</sub>
                  {a.sym}
                </span>
                <span className="text-sm text-slate-300">{a.name}</span>
              </div>
              <AtomSvg a={a} active={open} open={open} motion={motion} />
              <div className="relative mt-2 grid overflow-hidden">
                <div
                  aria-hidden={open}
                  className="col-start-1 row-start-1 grid content-start gap-1 transition-all duration-500 ease-out"
                  style={{ transform: open ? "translateX(105%)" : "translateX(0)", opacity: open ? 0 : 1 }}
                >
                  {stat("پروتون (p)", a.z, "bg-red-500")}
                  {stat("نوترون (n)", a.n, "bg-slate-400")}
                  {stat("الکترون (e)", a.z, "bg-sky-400")}
                </div>
                <div
                  aria-hidden={!open}
                  className="col-start-1 row-start-1 rounded-lg bg-white/5 px-2.5 py-2 text-[13px] leading-7 text-slate-200 transition-all duration-500 ease-out"
                  style={{ transform: open ? "translateX(0)" : "translateX(-105%)", opacity: open ? 1 : 0 }}
                >
                  <p className="mb-1 font-bold text-sky-300">هسته‌ی {a.name}</p>
                  هسته از {toFa(a.z)} پروتون{a.n ? ` و ${toFa(a.n)} نوترون` : " ساخته شده و نوترون ندارد"} تشکیل شده است. عدد اتمی {a.name} {toFa(a.z)} است و اتم {toFa(a.z)} الکترون هم دارد؛ پس بار کل آن صفر است.
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
