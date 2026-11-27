import { useMemo, useState } from "react";
import { CATEGORY, ELEMENT_LIST, gridPos, type Category, type ChemElement } from "@/lib/elements";
import { toFa } from "@/lib/fa";
import { ElementDialog } from "./ElementDialog";

interface Props {
  /** عدد اتمی عنصرهایی که برجسته می‌شوند؛ بقیه کم‌رنگ می‌شوند (اگر ندهید همه برجسته‌اند) */
  highlight?: number[];
  /** عنصر انتخاب‌شده در حالت کنترل‌شده */
  selected?: number | null;
  /** اگر بدهید، پاپ‌آپ داخلی باز نمی‌شود و انتخاب به شما اطلاع داده می‌شود */
  onSelect?: (el: ChemElement) => void;
  /** نمایش راهنمای دسته‌ها (قابل کلیک برای فیلتر) */
  legend?: boolean;
  /** نمایش نام فارسی زیر نشانه */
  showNames?: boolean;
}

/** جدول تناوبی (مندلیف) با راهنمای دسته‌ها و پاپ‌آپ جزئیات؛ قابل استفاده در هر درس. */
export function PeriodicTable({ highlight, selected, onSelect, legend = true, showNames = true }: Props) {
  const [inner, setInner] = useState<number | null>(null);
  const [cat, setCat] = useState<Category | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const hl = useMemo(() => (highlight ? new Set(highlight) : null), [highlight]);
  const open = selected !== undefined ? selected : inner;
  const hoverEl = hover ? ELEMENT_LIST[hover - 1] : undefined;

  const pick = (e: ChemElement) => (onSelect ? onSelect(e) : setInner(e.z));

  return (
    <div className="space-y-3">
      {legend && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="دسته‌ی عنصرها">
          {(Object.keys(CATEGORY) as Category[]).map((c) => {
            const on = cat === c;
            return (
              <button
                key={c}
                aria-pressed={on}
                onClick={() => setCat(on ? null : c)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${on ? "text-white" : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"}`}
                style={{ borderColor: CATEGORY[c].color, background: on ? CATEGORY[c].color : undefined }}
              >
                <span className="size-2.5 rounded-full" style={{ background: CATEGORY[c].color }} aria-hidden="true" />
                {CATEGORY[c].fa}
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/60">
        <div
          dir="ltr"
          className="relative grid min-w-[46rem] gap-[3px]"
          style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: "repeat(7, auto) 0.6rem repeat(2, auto)" }}
        >
          {/* توضیح عنصر زیر نشانگر در فضای خالی بالای جدول */}
          <div className="pointer-events-none col-span-10 col-start-3 row-span-3 row-start-1 flex items-center justify-center text-center" dir="rtl" aria-hidden="true">
            {hoverEl ? (
              <div>
                <div className="text-3xl font-black" style={{ color: CATEGORY[hoverEl.category].color }}>
                  <span className="ltr" dir="ltr">{hoverEl.symbol}</span> · {hoverEl.fa}
                </div>
                <div className="text-sm text-slate-500">
                  عدد اتمی {toFa(hoverEl.z)} · جرم اتمی {toFa(hoverEl.mass)} · {CATEGORY[hoverEl.category].fa}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">روی یک عنصر بزنید تا جزئیات آن را ببینید</div>
            )}
          </div>

          {ELEMENT_LIST.map((e) => {
            const { col, row } = gridPos(e);
            const c = CATEGORY[e.category].color;
            const dim = (hl && !hl.has(e.z)) || (cat && e.category !== cat);
            return (
              <button
                key={e.z}
                onClick={() => pick(e)}
                onMouseEnter={() => setHover(e.z)}
                onMouseLeave={() => setHover((h) => (h === e.z ? null : h))}
                onFocus={() => setHover(e.z)}
                onBlur={() => setHover((h) => (h === e.z ? null : h))}
                aria-label={`${e.fa}، عدد اتمی ${e.z}`}
                className="group relative flex aspect-[5/6] min-w-0 flex-col items-center justify-center rounded-md border text-center leading-none transition hover:z-10 hover:scale-125 hover:shadow-lg focus-visible:z-10 focus-visible:scale-125 focus-visible:outline-2"
                style={{
                  gridColumn: col,
                  gridRow: row,
                  background: `${c}2b`,
                  borderColor: `${c}99`,
                  opacity: dim ? 0.25 : 1,
                  boxShadow: open === e.z ? `0 0 0 2px ${c}` : undefined,
                }}
              >
                <span className="absolute start-0.5 top-0.5 text-[8px] font-semibold text-slate-600 dark:text-slate-300">{toFa(e.z)}</span>
                <span className="text-[13px] font-extrabold sm:text-base">{e.symbol}</span>
                {showNames && <span dir="rtl" className="mt-0.5 hidden max-w-full truncate px-0.5 text-[8px] text-slate-600 sm:block dark:text-slate-300">{e.fa}</span>}
              </button>
            );
          })}

          {/* جای لانتانیدها و آکتینیدها در جدول اصلی */}
          {[
            { row: 6, label: "۵۷–۷۱", color: CATEGORY.lanthanide.color },
            { row: 7, label: "۸۹–۱۰۳", color: CATEGORY.actinide.color },
          ].map((p) => (
            <div
              key={p.row}
              aria-hidden="true"
              className="flex aspect-[5/6] items-center justify-center rounded-md border border-dashed text-[8px] text-slate-500"
              style={{ gridColumn: 3, gridRow: p.row, borderColor: p.color }}
            >
              {p.label}
            </div>
          ))}
        </div>
      </div>

      {onSelect === undefined && <ElementDialog z={open} onClose={() => setInner(null)} onNavigate={setInner} />}
    </div>
  );
}
