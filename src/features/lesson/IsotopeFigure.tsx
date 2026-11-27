import { useId, useMemo, useState } from "react";
import { toFa } from "@/lib/fa";
import { Eye, EyeOff } from "lucide-react";
import { Nuclide } from "./Inline";
import { BohrAtom } from "./BohrFigure";

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

interface Particle {
  x: number;
  y: number;
  proton: boolean;
  /** نوترونی که نسبت به سبک‌ترین ایزوتوپ اضافه است */
  extra: boolean;
}

/**
 * هسته‌ی پایدار: موقعیت ذره‌ها فقط به شماره‌ی آن‌ها بستگی دارد، پس هسته‌ی ایزوتوپ سنگین‌تر
 * دقیقاً همان هسته‌ی سبک‌تر است با چند نوترون بیشتر در لبه.
 */
function nucleus(p: number, nBase: number, nExtra: number, u: number): Particle[] {
  const base = p + nBase;
  const total = base + nExtra;
  return Array.from({ length: total }, (_, i) => {
    const r = i === 0 && total === 1 ? 0 : u * 1.08 * Math.sqrt(i + 0.5);
    const a = i * GOLDEN;
    const isBase = i < base;
    const proton = isBase && Math.floor(((i + 1) * p) / base) > Math.floor((i * p) / base);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, proton, extra: !isBase };
  });
}

const GRADS = (uid: string) => (
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
  </defs>
);

export interface IsoDef {
  mass: number;
  name: string;
}
const P = 6; // پروتون‌های کربن
export const CARBON: IsoDef[] = [
  { mass: 12, name: "کربن ۱۲" },
  { mass: 13, name: "کربن ۱۳" },
  { mass: 14, name: "کربن ۱۴" },
];

function Nucleus({ iso, u, cx, cy, highlight, uid }: { iso: IsoDef; u: number; cx: number; cy: number; highlight: boolean; uid: string }) {
  const nExtra = iso.mass - 12;
  const parts = useMemo(() => nucleus(P, 6, nExtra, u), [nExtra, u]);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {parts.map((q, i) => (
        <g key={i}>
          <circle cx={q.x} cy={q.y} r={u} fill={`url(#${uid}${q.proton ? "p" : "n"})`} stroke="#0f172a" strokeOpacity="0.3" strokeWidth="0.4" />
          {highlight && q.extra && (
            <circle cx={q.x} cy={q.y} r={u + 2.2} fill="none" stroke="#4ade80" strokeWidth="2.2" style={{ transition: "opacity .3s" }} />
          )}
        </g>
      ))}
    </g>
  );
}

/** شکل ۳ کتاب: نوک مداد ← شبکه‌ی اتم‌های کربن ← یک اتم ← هسته‌ی سه ایزوتوپ کربن. */
export function IsotopeFigure({ image }: { image: string }) {
  const uid = useId().replace(/:/g, "");
  const [show, setShow] = useState(true);
  const src = { x: 236, y: 256 }; // جای اتم در تصویر
  const bubbles = [
    { iso: CARBON[0], cx: 612, cy: 86, r: 70 },
    { iso: CARBON[1], cx: 470, cy: 306, r: 66 },
    { iso: CARBON[2], cx: 628, cy: 306, r: 66 },
  ];
  const cone = (b: { cx: number; cy: number; r: number }) => {
    const dx = b.cx - src.x;
    const dy = b.cy - src.y;
    const d = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx);
    const a = Math.asin(b.r / d);
    const t = Math.sqrt(d * d - b.r * b.r);
    const pt = (s: number) => `${src.x + Math.cos(th + s * a) * t},${src.y + Math.sin(th + s * a) * t}`;
    return `${src.x},${src.y} ${pt(1)} ${pt(-1)}`;
  };
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-100">
        <svg viewBox="0 0 720 424" className="mx-auto block w-full max-w-3xl" role="img" aria-label="از نوک مداد تا هسته‌ی سه ایزوتوپ کربن">
          {GRADS(uid)}
          <image href={image} x="0" y="14" width="399" height="337" />
          {bubbles.map((b, i) => (
            <polygon key={`c${i}`} points={cone(b)} fill="#a5def8" fillOpacity="0.75" />
          ))}
          <circle cx={src.x} cy={src.y} r="3.2" fill="#ef4444" />
          {bubbles.map((b, i) => (
            <g key={i}>
              <circle cx={b.cx} cy={b.cy} r={b.r} fill="#fff" stroke="#5bc8f0" strokeWidth="3.5" />
              <Nucleus iso={b.iso} u={7.6} cx={b.cx} cy={b.cy} highlight={show} uid={uid} />
              <text x={b.cx} y={b.cy + b.r + 26} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">
                {`${b.iso.mass}`}
                <tspan fontSize="16" dy="-8">C</tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-red-200 to-red-700" />پروتون</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-gradient-to-br from-slate-100 to-slate-600" />نوترون</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full ring-2 ring-green-400" />نوترون اضافه نسبت به کربن ۱۲</span>
        </span>
        <button
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {show ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
          {show ? "پنهان‌کردن نشانه‌ی تفاوت" : "نمایش تفاوت"}
        </button>
      </div>
    </div>
  );
}

/** مثال تصویری: هسته‌ی کربن ۱۲، ۱۳ و ۱۴ بزرگ و کنار هم؛ فقط تعداد نوترون‌ها فرق می‌کند. */
export function IsotopeCompare() {
  const uid = useId().replace(/:/g, "");
  const [show, setShow] = useState(true);
  return (
    <div className="overflow-hidden rounded-3xl border border-sky-900/40 bg-gradient-to-b from-slate-950 via-slate-900 to-[#0b1a33] p-3 text-white shadow-xl sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">هسته‌ی سه ایزوتوپ کربن: پروتون‌ها یکسان‌اند، فقط نوترون‌ها فرق می‌کنند.</p>
        <button
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
        >
          {show ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
          {show ? "پنهان‌کردن تفاوت" : "نمایش تفاوت"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {CARBON.map((iso) => {
          const n = iso.mass - P;
          const extra = iso.mass - 12;
          return (
            <div key={iso.mass} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <p className="mb-1 flex items-center justify-between">
                <span className="text-lg"><Nuclide sym="C" a={String(iso.mass)} z="6" /></span>
                <span className="text-sm text-slate-300">{iso.name}</span>
              </p>
              <svg viewBox="-60 -60 120 120" className="mx-auto block w-full max-w-[13rem]" role="img" aria-label={`هسته‌ی ${iso.name}: ${toFa(P)} پروتون و ${toFa(n)} نوترون`}>
                {GRADS(uid + iso.mass)}
                <circle r="52" fill="#fb923c" fillOpacity="0.12" />
                <Nucleus iso={iso} u={7.2} cx={0} cy={0} highlight={show} uid={uid + iso.mass} />
              </svg>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[13px]">
                <div className="rounded-lg bg-red-500/15 py-1"><div className="text-xs text-red-200">پروتون</div><b>{toFa(P)}</b></div>
                <div className="rounded-lg bg-slate-400/15 py-1"><div className="text-xs text-slate-300">نوترون</div><b>{toFa(n)}</b></div>
                <div className="rounded-lg bg-sky-400/15 py-1"><div className="text-xs text-sky-200">عدد جرمی</div><b>{toFa(iso.mass)}</b></div>
              </div>
              <p className="mt-2 h-6 text-center text-xs text-green-300">
                {extra === 0 ? "پایه‌ی مقایسه" : show ? `${toFa(extra)} نوترون بیشتر از کربن ۱۲` : ""}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] leading-7 text-slate-200">
        عدد جرمی = تعداد پروتون‌ها + تعداد نوترون‌ها. چون تعداد پروتون‌ها (۶) در هر سه یکسان است، هر سه کربن‌اند؛ اما با افزایش نوترون‌ها جرم هسته بیشتر می‌شود.
      </p>
    </div>
  );
}

const MASS_COLOR = "#a21caf";
const Z_COLOR = "#1d6fd1";

/** شکل ۴ کتاب: ایزوتوپ‌های کربن در یک نمونه زغال‌سنگ (سه اتم + نماد هسته‌ای + پیکان از سنگ). */
export function CoalIsotopeFigure({ image }: { image: string }) {
  const atoms = [
    { x: 110, mass: 12 },
    { x: 305, mass: 13 },
    { x: 500, mass: 14 },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-100">
      <svg viewBox="0 0 800 470" style={{ direction: "ltr" }} className="mx-auto block w-full max-w-3xl" role="img" aria-label="ایزوتوپ‌های کربن (کربن ۱۲، ۱۳ و ۱۴) در یک نمونه زغال‌سنگ">
        <defs>
          <marker id="coal-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={Z_COLOR} />
          </marker>
        </defs>
        {atoms.map((a) => (
          <g key={a.mass}>
            <svg x={a.x} y={0} width="190" height="190" viewBox="0 0 200 200">
              <BohrAtom p={6} n={a.mass - 6} e={6} />
            </svg>
            {/* نماد هسته‌ای: عدد جرمی بالا، عدد اتمی پایین، سمت چپ نشانه */}
            <g fontFamily="inherit">
              <text x={a.x + 65} y="236" fontSize="24" fontWeight="700" fill={MASS_COLOR} textAnchor="middle">{toFa(a.mass)}</text>
              <text x={a.x + 65} y="262" fontSize="24" fontWeight="700" fill={Z_COLOR} textAnchor="middle">{toFa(6)}</text>
              <text x={a.x + 105} y="258" fontSize="48" fontWeight="500" fill="#0f172a" textAnchor="middle">C</text>
            </g>
          </g>
        ))}
        {/* راهنمای عدد جرمی و عدد اتمی */}
        <g fontSize="17" fontWeight="700">
          <text x="112" y="233" fill={MASS_COLOR} textAnchor="end">عدد جرمی</text>
          <line x1="118" y1="228" x2="142" y2="228" stroke={MASS_COLOR} strokeWidth="2.4" />
          <text x="112" y="268" fill={Z_COLOR} textAnchor="end">عدد اتمی</text>
          <line x1="118" y1="262" x2="142" y2="262" stroke={Z_COLOR} strokeWidth="2.4" />
        </g>
        {/* پیکان‌ها از سنگ به هر اتم */}
        <g fill="none" stroke={Z_COLOR} strokeWidth="9" strokeLinecap="round" markerEnd="url(#coal-arrow)">
          <path d="M378 352 C370 312 300 306 245 290" />
          <path d="M400 350 L400 300" />
          <path d="M422 352 C430 312 500 306 555 290" />
        </g>
        <image href={image} x="302" y="352" width="196" height="116" preserveAspectRatio="xMidYMid meet" />
      </svg>
    </div>
  );
}
