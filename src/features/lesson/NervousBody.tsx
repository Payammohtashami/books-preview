import { useEffect, useRef, useState } from "react";
import { ChevronsLeft, Eye, EyeOff, RotateCcw, Tag } from "lucide-react";
import type { BodyView3D } from "../body/body-view3d";
import { Inline } from "./Inline";

/* فقط لایهٔ عصبیِ مدل سه‌بعدی بادبان؛ رنگ‌ها و برچسب‌ها مانند شکل ۱ کتاب */
const IDS = [
  "cerebrum", "cerebellum", "brainstem", "spinal-cord", "cauda-equina", "vagus-nerve", "brachial-plexus", "median-nerve", "ulnar-nerve",
  "radial-nerve", "femoral-nerve", "sciatic-nerve", "tibial-nerve", "fibular-nerve", "spinal-nerves", "intercostal-nerves", "sympathetic-trunk",
  "phrenic-nerve", "musculocutaneous-nerve", "axillary-nerve", "lumbosacral-plexus", "obturator-nerve", "saphenous-nerve", "plantar-nerves", "sural-nerve",
];
const VISIBLE = new Set(IDS);
const BLUE = "#1d4ea8";
const RED = "#e0182d";
const COLORS: Record<string, string> = Object.fromEntries(IDS.map((i) => [i, RED]));
Object.assign(COLORS, { cerebrum: "#b894d0", cerebellum: "#a3add9", brainstem: BLUE, "spinal-cord": BLUE, "cauda-equina": BLUE });
const LABEL = "#2a73c9";

type P3 = [number, number, number];
interface Pts { brain: P3; cord: P3; brainTop: number; cordY: number; armTop: number; footBottom: number; nerves: P3[] }

export default function NervousBody({ text, heading, text2, caption }: { text?: string; heading?: string; text2?: string; caption?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<BodyView3D | null>(null);
  const ptsRef = useRef<Pts | null>(null);
  const el = useRef<Record<string, HTMLElement | SVGElement | null>>({});
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  const [skin, setSkin] = useState(true);
  const [names, setNames] = useState(false);
  const namesRef = useRef(names);
  namesRef.current = names;

  useEffect(() => {
    const b = boxRef.current;
    if (!b) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(b);
    return () => io.disconnect();
  }, []);

  /** جای برچسب‌ها و خط‌ها را با دوربین هماهنگ می‌کند */
  const layout = () => {
    const v = viewRef.current, pts = ptsRef.current, box = boxRef.current, cw = canvasWrap.current;
    if (!v || !pts || !box || !cw) return;
    const show = namesRef.current;
    const g = el.current.g as SVGElement | null;
    if (g) g.style.display = show ? "" : "none";
    for (const k of ["brainL", "cordL", "nervL", "centralL", "periL"]) { const n = el.current[k] as HTMLElement | null; if (n) n.style.display = show ? "" : "none"; }
    if (!show) return;
    const W = box.clientWidth, H = box.clientHeight;
    const lx = W * 0.72, bx = W * 0.81;
    const P = (p: P3) => v.project(p[0], p[1], p[2]);
    const place = (k: string, x: number, y: number) => { const n = el.current[k] as HTMLElement | null; if (n) { n.style.left = `${x}px`; n.style.top = `${y}px`; } };
    const line = (k: string, x1: number, y1: number, x2: number, y2: number) => {
      const n = el.current[k]; if (!n) return;
      n.setAttribute("x1", String(x1)); n.setAttribute("y1", String(y1)); n.setAttribute("x2", String(x2)); n.setAttribute("y2", String(y2));
    };
    const bracket = (k: string, y1: number, y2: number) => {
      const n = el.current[k]; if (n) n.setAttribute("d", `M${bx - 7},${y1} H${bx} V${y2} H${bx - 7}`);
    };
    const edge = (k: string) => lx - ((el.current[k] as HTMLElement | null)?.offsetWidth ?? 24) / 2 - 4;
    const brain = P(pts.brain), cord = P(pts.cord);
    // مغز
    const by = brain.y - H * 0.05;
    place("brainL", lx, by); line("brainLine", edge("brainL"), by, brain.x, brain.y);
    // نخاع
    place("cordL", lx, cord.y); line("cordLine", edge("cordL"), cord.y, cord.x, cord.y);
    // اعصاب
    const ps = pts.nerves.map(P);
    const ny = ps[2].y;
    place("nervL", lx, ny);
    ps.forEach((p, i) => line(`nervLine${i}`, edge("nervL"), ny, p.x, p.y));
    // بخش مرکزی / محیطی
    const t = P([pts.brain[0], pts.brainTop, pts.brain[2]]).y - 2;
    const c = P([pts.cord[0], pts.cordY, pts.cord[2]]).y + 6;
    bracket("centralB", t, c); place("centralL", W * 0.9, (t + c) / 2);
    const a = P([pts.cord[0], pts.armTop, pts.cord[2]]).y;
    const f = P([pts.cord[0], pts.footBottom, pts.cord[2]]).y;
    bracket("periB", a, f); place("periL", W * 0.9, (a + f) / 2);
  };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => { layoutRef.current(); }, [names, on]);

  useEffect(() => {
    if (!on) return;
    let dead = false;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;
    (async () => {
      try {
        const { BodyView3D } = await import("../body/body-view3d");
        if (dead || !canvasRef.current || !canvasWrap.current) return;
        const v = new BodyView3D(canvasRef.current, { onPick: () => {}, onFrame: () => layoutRef.current() });
        viewRef.current = v;
        const cw = canvasWrap.current;
        const fit = () => { v.resize(cw.clientWidth, cw.clientHeight); layoutRef.current(); };
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(cw);
        v.setState({ visible: VISIBLE, selected: null, labels: false, skin: true, cut: 0, dark: false, names: {}, accents: {}, skinColor: "#f3b9c8", skinOpacity: 0.32, noGround: true, widthScale: 0.84, colors: COLORS });
        const box = (id: string) => v.partBox(id);
        const cer = box("cerebrum"), cord = box("spinal-cord"), arm = box("radial-nerve"), foot = box("plantar-nerves");
        const anc = (id: string): P3 => v.partAnchor(id) ?? [0, 1, 0];
        if (cer && cord && arm && foot) {
          const mid = (cord.min[0] + cord.max[0]) / 2;
          const mir = (p: P3): P3 => [2 * mid - p[0], p[1], p[2]]; // سمت راستِ تصویر
          ptsRef.current = {
            brain: [(cer.min[0] + cer.max[0]) / 2, (cer.min[1] + cer.max[1]) / 2, (cer.min[2] + cer.max[2]) / 2],
            cord: [mid, cord.max[1] - (cord.max[1] - cord.min[1]) * 0.1, (cord.min[2] + cord.max[2]) / 2],
            brainTop: cer.max[1],
            cordY: cord.max[1] - (cord.max[1] - cord.min[1]) * 0.1,
            armTop: arm.max[1],
            footBottom: foot.min[1],
            nerves: [mir(anc("radial-nerve")), mir(anc("intercostal-nerves")), mir(anc("tibial-nerve"))],
          };
        }
        v.start();
        io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.start() : v.stop()));
        io.observe(cw);
        layoutRef.current();
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => {
      dead = true;
      ro?.disconnect();
      io?.disconnect();
      viewRef.current?.dispose();
      viewRef.current = null;
    };
  }, [on]);

  useEffect(() => {
    viewRef.current?.setState({ visible: VISIBLE, selected: null, labels: false, skin, cut: 0, dark: false, names: {}, accents: {}, skinColor: "#f3b9c8", skinOpacity: 0.32, noGround: true, widthScale: 0.84, colors: COLORS });
  }, [skin, on]);

  const reg = (k: string) => (n: HTMLElement | SVGElement | null) => { el.current[k] = n; };
  const lab = "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] leading-none sm:text-sm";
  const paras = (t?: string) => (t ?? "").split("\n\n").filter(Boolean).map((x, i) => <p key={i}><Inline text={x} /></p>);
  const btn = "flex items-center gap-1 rounded-lg border border-slate-300 bg-white/90 px-2.5 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-100";

  return (
    <div className="grid items-center gap-4 md:grid-cols-2">
      <div className="space-y-3 leading-8">
        {paras(text)}
        {heading && (
          <h3 className="flex items-center gap-2 pt-2 text-xl font-bold text-brand-700 dark:text-brand-500">
            <ChevronsLeft className="size-5 shrink-0 text-orange-500" aria-hidden="true" /> {heading}
          </h3>
        )}
        {paras(text2)}
      </div>
      <figure>
        <div ref={boxRef} dir="ltr" className="relative h-[30rem] overflow-hidden rounded-2xl border border-slate-200 bg-white sm:h-[34rem]" role="img" aria-label="مدل سه‌بعدی دستگاه عصبی بدن انسان">
          {failed ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">مرورگر شما از نمایش سه‌بعدی پشتیبانی نمی‌کند.</div>
          ) : (
            <>
              <div ref={canvasWrap} className="absolute inset-0">
                <canvas ref={canvasRef} className="h-full w-full touch-none" style={{ filter: "drop-shadow(0 0 9px rgba(96,110,255,.65))" }} />
              </div>
              <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: "visible" }}>
                <g ref={reg("g")} stroke="#111" strokeWidth="1" fill="none" style={{ display: "none" }}>
                  <line ref={reg("brainLine")} /><line ref={reg("cordLine")} />
                  <line ref={reg("nervLine0")} /><line ref={reg("nervLine1")} /><line ref={reg("nervLine2")} />
                  <path ref={reg("centralB")} /><path ref={reg("periB")} />
                </g>
              </svg>
              {[["brainL", "مغز"], ["cordL", "نخاع"], ["nervL", "اعصاب"], ["centralL", "بخش مرکزی"], ["periL", "بخش محیطی"]].map(([k, t]) => (
                <span key={k} ref={reg(k)} className={lab} style={{ color: LABEL, display: "none", direction: "rtl" }}>{t}</span>
              ))}
              <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5" dir="rtl">
                <button onClick={() => setNames((s) => !s)} className={btn} aria-pressed={names}><Tag size={14} /> نام اجزا</button>
                <button onClick={() => setSkin((s) => !s)} className={btn}>{skin ? <EyeOff size={14} /> : <Eye size={14} />} {skin ? "پنهان‌کردن پوست" : "نمایش پوست"}</button>
                <button onClick={() => viewRef.current?.home()} className={btn}><RotateCcw size={14} /> بازنشانی</button>
              </div>
            </>
          )}
        </div>
        {caption && <figcaption className="mt-2 text-center text-sm text-sky-700 dark:text-sky-300"><Inline text={caption} /></figcaption>}
      </figure>
    </div>
  );
}
