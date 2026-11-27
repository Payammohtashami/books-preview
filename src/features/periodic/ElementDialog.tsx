import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CATEGORY, STATE_FA, elementByZ, type ChemElement } from "@/lib/elements";
import { toFa } from "@/lib/fa";
import { Nuclide } from "@/features/lesson/Inline";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const SHELL_COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#fb7185", "#c084fc", "#f97316"];

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SPREAD = 1.55;

/** مدل بور عنصر: هسته‌ی واقعی (پروتون قرمز، نوترون خاکستری) و الکترون‌ها در لایه‌ها. با هاور روی شکل هسته باز می‌شود. */
function AtomDiagram({ el }: { el: ChemElement }) {
  const uid = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const p = el.z;
  const n = Math.max(0, Math.round(el.mass) - el.z);
  const total = p + n;
  const k = el.shells.length;
  const R = 94;
  const dense = el.z > 36;

  const nucR = total === 1 ? 7 : Math.min(26, 8 + 1.6 * Math.sqrt(total));
  const u = total === 1 ? 7 : nucR / (1.08 * Math.sqrt(total) + 1);
  const parts = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => {
        const r = total === 1 ? 0 : u * 1.08 * Math.sqrt(i + 0.5);
        const ang = i * GOLDEN;
        const proton = Math.floor(((i + 1) * p) / total) > Math.floor((i * p) / total);
        return { x: Math.cos(ang) * r, y: Math.sin(ang) * r, proton };
      }),
    [total, p, u],
  );
  const spread = total > 1 ? SPREAD : 1;
  const inner = nucR * spread + (k > 3 ? 7 : 10);

  return (
    <svg
      viewBox="0 0 200 200"
      className="mx-auto block w-full max-w-[15rem] cursor-pointer"
      role="img"
      aria-label={`مدل اتم ${el.fa}: ${p} پروتون، ${n} نوترون و ${p} الکترون`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
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
        <radialGradient id={`${uid}g`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r={nucR * (open ? spread : 1) + 16} fill={`url(#${uid}g)`} />
      {el.shells.map((cnt, i) => {
        const r = k === 1 ? Math.max(inner, 46) : inner + ((R - inner) * i) / (k - 1);
        const c = SHELL_COLORS[i % SHELL_COLORS.length];
        const er = dense ? 1.8 : 3.4;
        return (
          <g key={i}>
            <circle cx="100" cy="100" r={r} fill="none" stroke={c} strokeOpacity="0.45" strokeWidth="0.9" />
            <g style={{ transformOrigin: "100px 100px", animation: `el-spin ${10 + i * 5}s linear infinite${i % 2 ? " reverse" : ""}` }}>
              {Array.from({ length: cnt }, (_, j) => {
                const a = (j / cnt) * Math.PI * 2 + i * 0.6;
                return <circle key={j} cx={100 + Math.cos(a) * r} cy={100 + Math.sin(a) * r} r={er} fill={c} />;
              })}
            </g>
          </g>
        );
      })}
      <g transform="translate(100 100)">
        {parts.map((q, i) => (
          <circle
            key={i}
            r={u}
            fill={`url(#${uid}${q.proton ? "p" : "n"})`}
            stroke="#0f172a"
            strokeOpacity="0.35"
            strokeWidth={u > 2 ? 0.3 : 0.12}
            style={{
              transform: `translate(${q.x * (open ? spread : 1)}px, ${q.y * (open ? spread : 1)}px)`,
              transition: "transform 600ms cubic-bezier(.2,.8,.2,1)",
            }}
          />
        ))}
      </g>
    </svg>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 py-2 text-sm last:border-0 dark:border-slate-700/70">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

interface Props {
  /** عدد اتمی عنصر انتخاب‌شده؛ null یعنی بسته */
  z: number | null;
  onClose: () => void;
  /** با فلش‌ها بین عنصرها جابه‌جا می‌شود */
  onNavigate?: (z: number) => void;
}

/** پنجره‌ی (پاپ‌آپ) جزئیات یک عنصر. با کلید Esc، دکمه‌ی بستن یا کلیک بیرون بسته می‌شود. */
export function ElementDialog({ z, onClose, onNavigate }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const el = z ? elementByZ(z) : undefined;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (z && !d.open) d.showModal();
    if (!z && d.open) d.close();
  }, [z]);

  useEffect(() => {
    if (!z) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [z]);

  // کتاب راست‌به‌چپ است: فلش چپ = عنصر بعدی
  useEffect(() => {
    if (!z || !onNavigate) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && z < 118) onNavigate(z + 1);
      if (e.key === "ArrowRight" && z > 1) onNavigate(z - 1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [z, onNavigate]);

  const cat = el ? CATEGORY[el.category] : undefined;
  const A = el ? Math.round(el.mass) : 0;
  const nav = "grid size-9 place-items-center rounded-full border border-slate-300 bg-white/80 hover:bg-white disabled:opacity-30 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:bg-slate-800";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={el ? `جزئیات عنصر ${el.fa}` : "جزئیات عنصر"}
      className="m-auto w-[min(92vw,34rem)] max-h-[92dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <style>{`
        @keyframes el-spin{to{transform:rotate(360deg)}}
        @keyframes el-pop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
        dialog[open]{animation:el-pop .22s cubic-bezier(.2,.8,.2,1)}
        @media (prefers-reduced-motion: reduce){dialog[open]{animation:none}}
      `}</style>
      {el && cat && (
        <div>
          <div className="relative px-5 pb-4 pt-5" style={{ background: `linear-gradient(135deg, ${cat.color}33, transparent 70%)` }}>
            <button onClick={onClose} aria-label="بستن" className="absolute end-3 top-3 grid size-9 place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/10">
              <X className="size-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-4">
              <div className="grid size-24 shrink-0 place-items-center rounded-2xl border-2 bg-white/70 dark:bg-slate-900/60" style={{ borderColor: cat.color }}>
                <div className="ltr text-center leading-none" dir="ltr">
                  <div className="text-xs font-semibold" style={{ color: cat.color }}>{toFa(el.z)}</div>
                  <div className="text-5xl font-black">{el.symbol}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{toFa(el.mass)}</div>
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold">{el.fa}</h2>
                <p className="ltr text-slate-500" dir="ltr">{el.en}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: cat.color }}>
                  {cat.fa}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-[1fr_12rem]">
            <dl>
              <Row label="عدد اتمی (تعداد پروتون)">{toFa(el.z)}</Row>
              <Row label="تعداد نوترون (ایزوتوپ رایج، تقریبی)">{toFa(Math.max(0, Math.round(el.mass) - el.z))}</Row>
              <Row label="تعداد الکترون (اتم خنثی)">{toFa(el.z)}</Row>
              <Row label="جرم اتمی">{toFa(el.mass)}</Row>
              <Row label="نماد هسته‌ای"><Nuclide sym={el.symbol} a={String(A)} z={String(el.z)} /></Row>
              <Row label="گروه">{el.group ? toFa(el.group) : "—"}</Row>
              <Row label="دوره">{toFa(el.period)}</Row>
              <Row label="حالت در دمای اتاق">{STATE_FA[el.state]}</Row>
              <Row label="الکترون‌ها در لایه‌ها">
                {el.shells.map((s) => toFa(s)).join("، ")}
              </Row>
            </dl>
            <div className="self-center">
              <AtomDiagram el={el} />
              <p className="mt-1 flex items-center justify-center gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-red-500" />پروتون</span>
                <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-slate-400" />نوترون</span>
              </p>
              <p className="text-center text-[11px] text-slate-400">برای باز شدن هسته نشانگر را روی شکل ببرید</p>
            </div>
          </div>

          {onNavigate && (
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-700">
              <button className={nav} aria-label="عنصر قبلی" disabled={el.z <= 1} onClick={() => onNavigate(el.z - 1)}>
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
              <span className="text-xs text-slate-500">{toFa(el.z)} از {toFa(118)}</span>
              <button className={nav} aria-label="عنصر بعدی" disabled={el.z >= 118} onClick={() => onNavigate(el.z + 1)}>
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
