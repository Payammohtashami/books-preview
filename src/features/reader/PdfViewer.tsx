import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FolderOpen, RotateCcw, TriangleAlert } from "lucide-react";
import { getLocalPdf, saveLocalPdf } from "@/lib/localBooks";
import { toFa } from "@/lib/fa";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const docCache = new Map<string, Promise<PDFDocumentProxy>>();

const docOptions = {
  wasmUrl: "/pdfjs/wasm/",
  // رسم حروف به‌صورت مسیر: از شکل‌دهی/جهت‌دهی خودکار مرورگر روی کدهای عربی جلوگیری می‌کند
  disableFontFace: true,
};

function loadDoc(url: string): Promise<PDFDocumentProxy> {
  let p = docCache.get(url);
  if (!p) {
    p = (async () => {
      // اگر کاربر فایل را دستی انتخاب کرده بود، همان استفاده می‌شود (آفلاین هم کار می‌کند)
      const local = await getLocalPdf(url);
      if (local) return pdfjs.getDocument({ data: new Uint8Array(local), ...docOptions }).promise;
      // کل فایل در یک درخواست دریافت می‌شود تا Service Worker آن را برای حالت آفلاین کش کند.
      return pdfjs.getDocument({ url, disableRange: true, disableStream: true, ...docOptions }).promise;
    })();
    p.catch(() => docCache.delete(url));
    docCache.set(url, p);
  }
  return p;
}

async function saveAndUseLocalFile(url: string, file: File) {
  const buf = await file.arrayBuffer();
  await saveLocalPdf(url, buf.slice(0));
  docCache.delete(url);
}

const GAP = 14; // فاصله‌ی بین صفحه‌ها (px)

interface SlotProps {
  doc: PDFDocumentProxy;
  n: number;
  width: number;
  height: number;
}

/** یک صفحه: فقط وقتی نزدیک به صفحه‌ی دید است رسم می‌شود و بعد از دور شدن آزاد می‌شود. */
const PageSlot = memo(function PageSlot({ doc, n, width, height }: SlotProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "200% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      // آزادسازی حافظه‌ی صفحه‌های دور
      canvas.width = 1;
      canvas.height = 1;
      setDrawn(false);
      return;
    }
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      try {
        const pg = await doc.getPage(n);
        if (cancelled) return;
        const base = pg.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const vp = pg.getViewport({ scale: (width / base.width) * dpr });
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        task = pg.render({ canvas, viewport: vp });
        await task.promise;
        if (!cancelled) setDrawn(true);
      } catch (e) {
        if ((e as Error)?.name !== "RenderingCancelledException") console.error(e);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, n, width]);

  return (
    <div
      ref={boxRef}
      data-page={n}
      style={{ width, height }}
      className="relative mx-auto overflow-hidden bg-white shadow-lg"
    >
      {!drawn && (
        <span className="absolute inset-0 grid place-items-center text-sm text-slate-400" aria-hidden="true">
          {toFa(n)}
        </span>
      )}
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="block"
        role="img"
        aria-label={`صفحه‌ی ${toFa(n)} کتاب`}
      />
    </div>
  );
});

export interface JumpTarget {
  page: number;
  nonce: number;
}

interface Props {
  url: string;
  zoom: number;
  /** فاصله‌ی بالای صفحه که زیر هدر و نوار ابزار چسبنده پنهان است */
  stickyOffset: number;
  jump: JumpTarget;
  /** بازه‌ی صفحه‌هایی که نمایش داده می‌شوند (شماره‌ی PDF، شامل دو سر) */
  from: number;
  to: number;
  onTotal?: (n: number) => void;
  onPage?: (n: number) => void;
}

/** نمایش پیوسته‌ی کل کتاب: همه‌ی صفحه‌ها پشت سر هم و با اسکرول. */
export function PdfViewer({ url, zoom, stickyOffset, jump, from, to, onTotal, onPage }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.411); // ارتفاع / عرض
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [errorText, setErrorText] = useState("");
  const lastPage = useRef(0);
  // موقعیت فعلی اسکرول بر حسب «شماره‌ی صفحه‌ی اعشاری» تا هنگام زوم همان‌جا بماند
  const anchor = useRef<number | null>(null);
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const d = await loadDoc(url);
        const first = await d.getPage(1);
        if (cancelled) return;
        const vp = first.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        onTotal?.(d.numPages);
        setDoc(d);
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setErrorText(String((e as Error)?.message ?? e));
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, attempt, onTotal]);

  const pageWidth = Math.max(200, Math.min(width - 8, 1000) * zoom);
  const pageHeight = Math.round(pageWidth * ratio);
  const step = pageHeight + GAP;

  const scrollToPage = (n: number) => {
    const list = listRef.current;
    if (!list) return;
    const top = list.getBoundingClientRect().top + window.scrollY + (n - from) * step - stickyOffset;
    window.scrollTo({ top: Math.max(0, top) });
  };

  // پرش به صفحه (کلیک کاربر، فصل، باز شدن اولیه) و حفظ موقعیت هنگام تغییر زوم
  useLayoutEffect(() => {
    if (!doc || !width) return;
    if (lastNonce.current !== jump.nonce || anchor.current === null) {
      lastNonce.current = jump.nonce;
      scrollToPage(jump.page);
      lastPage.current = jump.page;
      anchor.current = jump.page;
    } else {
      scrollToPage(anchor.current); // تغییر زوم/عرض: همان نقطه‌ای که بودید
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, jump.nonce, pageWidth]);

  // تشخیص صفحه‌ی جاری هنگام اسکرول
  useEffect(() => {
    if (!doc) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const list = listRef.current;
      if (!list) return;
      const y = stickyOffset + 40; // خطی که صفحه‌ی جاری از روی آن تعیین می‌شود
      const frac = (y - list.getBoundingClientRect().top) / step;
      const top = list.getBoundingClientRect().top;
      anchor.current = Math.max(from, (stickyOffset - top) / step + from);
      const idx = Math.floor(frac);
      const n = Math.min(Math.max(from, idx + from), Math.min(to, doc.numPages));
      if (n !== lastPage.current) {
        lastPage.current = n;
        onPage?.(n);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [doc, step, stickyOffset, onPage, from, to]);

  return (
    <div ref={wrapRef} className="relative w-full overflow-x-auto rounded-xl bg-slate-200 p-1 dark:bg-slate-800" style={{ minHeight: "60dvh" }}>
      {state === "loading" && (
        <p role="status" className="absolute inset-0 grid place-items-center text-slate-600 dark:text-slate-300">
          در حال بارگذاری کتاب…
        </p>
      )}
      {state === "error" && (
        <div role="alert" className="absolute inset-0 grid place-items-center overflow-auto p-6 text-center">
          <div className="max-w-md space-y-3">
            <TriangleAlert className="mx-auto size-8 text-amber-500" aria-hidden="true" />
            <p>بارگذاری کتاب انجام نشد. اگر برای اولین بار است، اتصال اینترنت لازم است.</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              اگر مرورگر به‌جای نمایش، فایل را «دانلود» می‌کند، احتمالاً یک افزونه‌ی مدیریت دانلود (مثل IDM) جلوی بارگذاری را می‌گیرد.
              آن افزونه را برای این سایت غیرفعال کنید، یا فایل PDF کتاب را از پوشه‌ی پروژه دستی انتخاب کنید.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-white"
                onClick={() => {
                  docCache.delete(url);
                  setAttempt((a) => a + 1);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" /> تلاش دوباره
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand-700 px-4 py-2 text-brand-700 dark:text-brand-500">
                <FolderOpen className="size-4" aria-hidden="true" /> انتخاب فایل PDF از دستگاه
                <input
                  type="file"
                  accept=".pdf,.txt,application/pdf"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setState("loading");
                    await saveAndUseLocalFile(url, f);
                    setAttempt((a) => a + 1);
                  }}
                />
              </label>
            </div>
            {errorText && <p className="ltr break-words text-xs text-slate-500" dir="ltr">{errorText}</p>}
          </div>
        </div>
      )}
      {doc && width > 0 && (
        <div ref={listRef} className="mx-auto flex flex-col" style={{ width: pageWidth, gap: GAP }}>
          {Array.from({ length: Math.max(0, Math.min(to, doc.numPages) - from + 1) }, (_, i) => (
            <PageSlot key={from + i} doc={doc} n={from + i} width={pageWidth} height={pageHeight} />
          ))}
        </div>
      )}
    </div>
  );
}
