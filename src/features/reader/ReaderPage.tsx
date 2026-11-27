import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { bookPdfUrl, chapterForPage, loadBook, type Book } from "@/lib/content";
import { toEn, toFa } from "@/lib/fa";
import { ModeTabs } from "@/components/ModeTabs";
import { PdfViewer, type JumpTarget } from "./PdfViewer";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

const lastKey = (id: string) => `sb-last-page:${id}`;

/** حالت «کتاب»: نمایش خود صفحه‌های PDF. */
export function ReaderPage() {
  const { bookId = "", page: pageParam } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pageInput, setPageInput] = useState("");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [stickyOffset, setStickyOffset] = useState(150);
  const [headerH, setHeaderH] = useState(52);

  useEffect(() => {
    loadBook(bookId).then(setBook).catch((e: Error) => setError(e.message));
  }, [bookId]);

  let saved = 0;
  try { saved = Number(localStorage.getItem(lastKey(bookId))) || 0; } catch { /* ignore */ }
  const maxPage = book?.totalPages ?? (total || 9999);
  const startPage = Math.min(Math.max(1, Number(pageParam) || saved || 1), maxPage);

  // صفحه‌ی جاری (هنگام اسکرول به‌روز می‌شود) و فرمان پرش
  const [current, setCurrent] = useState(startPage);
  const [jump, setJump] = useState<JumpTarget>({ page: startPage, nonce: 0 });
  const lastSet = useRef(startPage);
  const sync = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ذخیره‌ی صفحه‌ی جاری در آدرس و حافظه (با تأخیر کوتاه تا هنگام اسکرول سریع تکرار نشود)
  const persist = useCallback(
    (n: number) => {
      lastSet.current = n;
      clearTimeout(sync.current);
      sync.current = setTimeout(() => {
        navigate(`/book/${bookId}/read/${n}`, { replace: true });
        try { localStorage.setItem(lastKey(bookId), String(n)); } catch { /* ignore */ }
      }, 350);
    },
    [navigate, bookId],
  );

  const goTo = useCallback(
    (p: number) => {
      const n = Math.min(Math.max(1, p), maxPage);
      setCurrent(n);
      setJump((j) => ({ page: n, nonce: j.nonce + 1 }));
      persist(n);
    },
    [maxPage, persist],
  );

  // وقتی کاربر با اسکرول صفحه را عوض کرد
  const onPage = useCallback(
    (n: number) => {
      setCurrent(n);
      persist(n);
    },
    [persist],
  );
  useEffect(() => () => clearTimeout(sync.current), []);

  // اگر آدرس از بیرون عوض شد (مثلاً لینک فصل)، به همان صفحه برو
  useEffect(() => {
    const n = Number(pageParam);
    if (n && n !== lastSet.current) goTo(n);
  }, [pageParam, goTo]);

  useEffect(() => { setPageInput(toFa(current)); }, [current]);

  useEffect(() => {
    const measure = () => {
      const h = document.querySelector("header")?.getBoundingClientRect().height ?? 52;
      setHeaderH(h);
      setStickyOffset(h + (toolbarRef.current?.offsetHeight ?? 90) + 8);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [book]);

  // کتاب راست‌به‌چپ است: فلش چپ = صفحه‌ی بعد
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") goTo(current + 1);
      else if (e.key === "ArrowRight") goTo(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, current]);

  if (error)
    return (
      <div className="space-y-3">
        <p role="alert" className="text-red-600">{error}</p>
        <Link to="/" className="text-brand-700 underline dark:text-brand-500">بازگشت</Link>
      </div>
    );
  if (!book) return <p>در حال بارگذاری…</p>;

  const page = current;
  const chapter = chapterForPage(book, page);
  // بخش جاری: یک فصل، یا صفحه‌های آغازین پیش از فصل اول
  const firstStart = book.chapters[0]?.startPage ?? 1;
  const from = chapter ? chapter.startPage : page < firstStart ? 1 : page;
  const to = chapter ? chapter.endPage : page < firstStart ? firstStart - 1 : maxPage;
  const chIdx = chapter ? book.chapters.indexOf(chapter) : -1;
  const prevCh = chapter ? book.chapters[chIdx - 1] : undefined;
  const nextCh = chapter ? book.chapters[chIdx + 1] : book.chapters[0];
  const prevTarget = prevCh ? prevCh.startPage : chapter && firstStart > 1 ? 1 : undefined;
  const printed = page - book.printedOffset;
  const btn = "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";

  return (
    <div className="space-y-4">
      <nav aria-label="مسیر" className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          <Link to="/" className="hover:underline">کتاب‌ها</Link>
          <ChevronLeft className="mx-1 inline size-4 align-[-0.2em]" aria-hidden="true" />
          <Link to={`/book/${book.id}`} className="hover:underline">{book.title} {book.gradeLabel}</Link>
          <ChevronLeft className="mx-1 inline size-4 align-[-0.2em]" aria-hidden="true" />
          <span>{chapter ? `فصل ${toFa(chapter.number)}` : "صفحه‌های آغازین"}</span>
        </div>
        <ModeTabs book={book} chapter={chapter} active="book" page={page} />
      </nav>

      <div
        ref={toolbarRef}
        style={{ top: headerH }}
        className="sticky z-30 -mx-4 space-y-1 border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      >
      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="ناوبری صفحه">
        {/* در RTL اولین دکمه سمت راست است: «قبلی» راست، «بعدی» چپ */}
        <button className={btn} onClick={() => goTo(page - 1)} disabled={page <= from && prevTarget === undefined}><ChevronRight className="size-4" aria-hidden="true" /> قبلی</button>
        <label className="flex items-center gap-1 text-sm">
          صفحه
          <input
            value={pageInput}
            inputMode="numeric"
            aria-label="شماره‌ی صفحه"
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => setPageInput(toFa(page))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseInt(toEn(pageInput), 10);
                if (n) goTo(n);
              }
            }}
            className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
          />
          از {toFa(to)}
        </label>
        <button className={btn} onClick={() => goTo(page + 1)} disabled={page >= to && !nextCh}>بعدی <ChevronLeft className="size-4" aria-hidden="true" /></button>

        <select
          aria-label="رفتن به فصل"
          value={chapter?.number ?? ""}
          onChange={(e) => {
            const c = book.chapters.find((x) => x.number === Number(e.target.value));
            if (c) goTo(c.startPage);
          }}
          className="ms-auto max-w-[11rem] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          {!chapter && <option value="">پیش از فصل‌ها</option>}
          {book.chapters.map((c) => (
            <option key={c.number} value={c.number}>فصل {toFa(c.number)}: {c.title}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button className={btn} aria-label="کوچک‌نمایی" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}><ZoomOut className="size-4" aria-hidden="true" /></button>
          <span className="w-12 text-center text-sm">{toFa(Math.round(zoom * 100))}٪</span>
          <button className={btn} aria-label="بزرگ‌نمایی" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}><ZoomIn className="size-4" aria-hidden="true" /></button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {printed >= 1 ? `صفحه‌ی ${toFa(printed)} کتاب` : "صفحه‌های آغازین"}
        {chapter ? ` · فصل ${toFa(chapter.number)}: ${chapter.title}` : ""}
        {chapter && ` · ${toFa(page - from + 1)} از ${toFa(to - from + 1)} صفحه‌ی فصل`}
      </p>
      </div>

      <PdfViewer
        url={bookPdfUrl(book)}
        zoom={zoom}
        stickyOffset={stickyOffset}
        jump={jump}
        from={from}
        to={to}
        onTotal={setTotal}
        onPage={onPage}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        {prevTarget !== undefined ? (
          <button className={btn} onClick={() => goTo(prevTarget)}>
            <ChevronRight className="size-4" aria-hidden="true" />
            {prevCh ? `فصل ${toFa(prevCh.number)}: ${prevCh.title}` : "صفحه‌های آغازین"}
          </button>
        ) : <span />}
        {nextCh && (
          <button className={`${btn} border-brand-700 bg-brand-700 text-white hover:bg-brand-700/90 dark:bg-brand-700 dark:hover:bg-brand-700/90`} onClick={() => goTo(nextCh.startPage)}>
            فصل {toFa(nextCh.number)}: {nextCh.title}
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
