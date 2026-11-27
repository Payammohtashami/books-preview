import { createContext, lazy, Suspense, useContext, useState } from "react";
import type { Block, CalloutKind, QuizQuestion } from "@/lib/lesson";
import { toFa } from "@/lib/fa";
import { Inline } from "./Inline";
import { CircleCheck, CircleX, ClipboardCheck, Brain, Search, ShieldAlert, Eye, EyeOff, FlaskConical, Lightbulb, MessagesSquare, RotateCcw, type LucideIcon } from "lucide-react";
import { ELEMENTS } from "./atoms";
import { AtomChoice, BohrFigure } from "./BohrFigure";
import { CoalIsotopeFigure, IsotopeCompare, IsotopeFigure } from "./IsotopeFigure";
import { ElementDialog } from "@/features/periodic/ElementDialog";
import { elementBySymbol } from "@/lib/elements";
const PeriodicTable = lazy(() => import("@/features/periodic/PeriodicTable").then((m) => ({ default: m.PeriodicTable })));

const AtomExplorer = lazy(() => import("./AtomExplorer"));
const NaClReaction = lazy(() => import("./NaClReaction"));
const RadioactivitySim = lazy(() => import("./RadioactivitySim"));
const AtomCompare = lazy(() => import("./AtomCompare"));
const NervousBody = lazy(() => import("./NervousBody"));
const BrainExplorer = lazy(() => import("./BrainExplorer"));
const NeuronFigure = lazy(() => import("./NeuronFigure"));
const ReflexArc = lazy(() => import("./ReflexArc"));
const SpinalSection = lazy(() => import("./SpinalSection"));

export const AssetContext = createContext<(file: string) => string>((f) => f);

const callout: Record<CalloutKind, { title: string; Icon: LucideIcon; box: string; badge: string }> = {
  discuss: { title: "گفت‌وگو کنید", Icon: MessagesSquare, box: "bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-900", badge: "bg-orange-500 text-white" },
  didYouKnow: { title: "آیا می‌دانید؟", Icon: Lightbulb, box: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900", badge: "bg-indigo-500 text-white" },
  activity: { title: "فعالیت", Icon: FlaskConical, box: "bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-900", badge: "bg-green-600 text-white" },
  think: { title: "فکر کنید", Icon: Brain, box: "bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:border-fuchsia-900", badge: "bg-fuchsia-600 text-white" },
  safety: { title: "هشدار ایمنی", Icon: ShieldAlert, box: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900", badge: "bg-red-600 text-white" },
  research: { title: "اطلاعات جمع‌آوری کنید", Icon: Search, box: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900", badge: "bg-blue-600 text-white" },
  selfCheck: { title: "خود را بیازمایید", Icon: ClipboardCheck, box: "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/40 dark:border-yellow-800", badge: "bg-yellow-500 text-slate-900" },
};

function Callout({ block }: { block: Extract<Block, { type: "callout" }> }) {
  const [show, setShow] = useState(false);
  const c = callout[block.kind];
  return (
    <aside className={`rounded-2xl border p-4 ${c.box}`}>
      <p className={`mb-2 inline-flex items-center gap-1 rounded-lg px-3 py-0.5 text-sm font-bold ${c.badge}`}>
        <c.Icon className="size-4" aria-hidden="true" /> {c.title}
      </p>
      {block.text && <p><Inline text={block.text} /></p>}
      {block.items && (
        <ul className="mt-1 space-y-1">
          {block.items.map((t, i) => (
            <li key={i}><Inline text={t} /></li>
          ))}
        </ul>
      )}
      {block.extras && (
        <div className="mt-3 space-y-3">
          {block.extras.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </div>
      )}
      {block.answer && (
        <div className="mt-3">
          <button
            onClick={() => setShow((s) => !s)}
            aria-expanded={show}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/50 bg-white/70 px-3 py-1 text-sm hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-800"
          >
            {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            {show ? "پنهان‌کردن پاسخ پیشنهادی" : "نمایش پاسخ پیشنهادی"}
          </button>
          {show && (
            <ul className="mt-2 space-y-1 rounded-lg bg-white/70 p-3 text-sm dark:bg-slate-800/70">
              {block.answer.map((t, i) => (
                <li key={i}><Inline text={t} /></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}

function Caption({ text }: { text?: string }) {
  return text ? <figcaption className="mt-2 text-center text-sm text-sky-700 dark:text-sky-300"><Inline text={text} /></figcaption> : null;
}

function ElementsGrid({ caption }: { caption?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const order = ["H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne"];
  const cell = (s: string, col: number, row: number) => {
    const e = ELEMENTS[s];
    return (
      <button
        key={s}
        type="button"
        onClick={() => setOpen(elementBySymbol(s)?.z ?? e.z)}
        aria-label={`جزئیات عنصر ${e.name}`}
        style={{ gridColumn: col, gridRow: row }}
        className={`rounded-lg border p-2 text-center transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 ${row === 1 ? "border-green-300 bg-green-100 hover:bg-green-200 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"}`}
      >
        <div className="ltr text-xl font-bold" dir="ltr">
          <sub className="me-0.5 text-xs text-red-600 dark:text-red-400">{toFa(e.z)}</sub>
          {e.symbol}
        </div>
        <div className="text-xs">{e.name}</div>
      </button>
    );
  };
  return (
    <figure className="space-y-1">
      <div className="grid grid-cols-8 gap-1.5 sm:gap-2" style={{ direction: "rtl" }}>
        {cell("H", 1, 1)}
        {cell("He", 8, 1)}
        {order.slice(2).map((s, i) => cell(s, i + 1, 2))}
      </div>
      <p className="text-center text-xs text-slate-500">روی هر عنصر بزنید تا جزئیاتش را ببینید.</p>
      <Caption text={caption} />
      <ElementDialog z={open} onClose={() => setOpen(null)} onNavigate={setOpen} />
    </figure>
  );
}

function Quiz({ title, questions }: { title: string; questions: QuizQuestion[] }) {
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null));
  const score = chosen.reduce<number>((s, c, i) => s + (c === questions[i].answer ? 1 : 0), 0);
  const done = chosen.every((c) => c !== null);
  return (
    <section className="space-y-4 rounded-2xl border border-brand-500/40 bg-brand-50 p-4 dark:bg-brand-900/30" aria-label={title}>
      <h3 className="text-lg font-bold">{title}</h3>
      {questions.map((q, qi) => {
        const sel = chosen[qi];
        return (
          <fieldset key={qi} className="space-y-2">
            <legend className="mb-1 font-medium"><span className="me-1">{toFa(qi + 1)}.</span><Inline text={q.q} /></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const isAns = oi === q.answer;
                const state = sel === null ? "" : isAns ? "border-green-600 bg-green-100 dark:bg-green-950" : sel === oi ? "border-red-500 bg-red-100 dark:bg-red-950" : "opacity-60";
                return (
                  <button
                    key={oi}
                    disabled={sel !== null}
                    onClick={() => setChosen((c) => c.map((x, i) => (i === qi ? oi : x)))}
                    className={`rounded-xl border border-slate-300 bg-white px-3 py-2 text-start dark:border-slate-600 dark:bg-slate-800 ${state}`}
                  >
                    <Inline text={o} />
                  </button>
                );
              })}
            </div>
            {sel !== null && (
              <p role="status" className="text-sm">
                {sel === q.answer ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700 dark:text-green-400"><CircleCheck className="size-4" aria-hidden="true" /> درست است.</span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400"><CircleX className="size-4" aria-hidden="true" /> درست نبود.</span>
                )}{" "}
                <Inline text={q.explanation} />
              </p>
            )}
          </fieldset>
        );
      })}
      {done && (
        <p role="status" className="font-bold">
          نتیجه: {toFa(score)} از {toFa(questions.length)}
        </p>
      )}
      {chosen.some((c) => c !== null) && (
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/50 px-3 py-1 text-sm" onClick={() => setChosen(questions.map(() => null))}>
          <RotateCcw className="size-4" aria-hidden="true" /> شروع دوباره
        </button>
      )}
    </section>
  );
}

export function BlockView({ block }: { block: Block }) {
  const asset = useContext(AssetContext);
  switch (block.type) {
    case "p":
      return (
        <div className="space-y-4">
          {block.text.split("\n\n").map((para, i) => (
            <p key={i} className="leading-[2] text-pretty sm:leading-[2.1]"><Inline text={para} /></p>
          ))}
        </div>
      );
    case "callout":
      return <Callout block={block} />;
    case "table":
      return (
        <figure>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[22rem] border-collapse text-center text-sm sm:text-base">
              <thead>
                <tr className="bg-yellow-200 dark:bg-yellow-900/60">
                  {block.head.map((h, i) => <th key={i} className="border border-slate-200 px-3 py-2 dark:border-slate-700"><Inline text={h} /></th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r, ri) => (
                  <tr key={ri} className={ri % 2 ? "bg-pink-50 dark:bg-pink-950/30" : "bg-fuchsia-50 dark:bg-fuchsia-950/30"}>
                    {r.map((c, ci) => (
                      <td key={ci} className={`border border-slate-200 px-3 py-2 dark:border-slate-700 ${ci === 0 ? "bg-green-100 font-semibold dark:bg-green-950/50" : ""}`}><Inline text={c} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Caption text={block.caption} />
        </figure>
      );
    case "figure":
      return (
        <figure className={block.compact ? "mx-auto max-w-sm" : "mx-auto max-w-2xl"}>
          <img src={asset(block.image)} alt={block.alt} loading="lazy" className="mx-auto w-full rounded-2xl shadow" />
          <Caption text={block.caption} />
        </figure>
      );
    case "gallery":
      return (
        <figure>
          <div className="grid gap-3 sm:grid-cols-3">
            {block.items.map((it) => (
              <div key={it.image} className="space-y-1 rounded-2xl bg-yellow-100 p-2 dark:bg-yellow-950/40">
                <img src={asset(it.image)} alt={it.alt} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-contain bg-white" />
                <p className="text-center text-sm text-sky-700 dark:text-sky-300"><Inline text={it.caption} /></p>
              </div>
            ))}
          </div>
          <Caption text={block.caption} />
        </figure>
      );
    case "elementsGrid":
      return <ElementsGrid caption={block.caption} />;
    case "isotopeFigure":
      return (
        <figure>
          <IsotopeFigure image={asset(block.image)} />
          <Caption text={block.caption} />
        </figure>
      );
    case "naclReaction":
      return (
        <figure>
          <Suspense fallback={<div className="grid h-72 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری مدل سه‌بعدی…</div>}>
            <NaClReaction />
          </Suspense>
          <Caption text={block.caption} />
        </figure>
      );
    case "radioactivity":
      return (
        <figure>
          <Suspense fallback={<div className="grid h-48 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری شبیه‌سازی…</div>}>
            <RadioactivitySim />
          </Suspense>
          <Caption text={block.caption} />
        </figure>
      );
    case "nervousBody":
      return (
        <Suspense fallback={<div className="grid h-48 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری…</div>}>
          <NervousBody text={block.text} heading={block.heading} text2={block.text2} caption={block.caption} />
        </Suspense>
      );
    case "brainExplorer":
    case "neuronFigure":
    case "reflexArc":
    case "spinalSection": {
      const C = { brainExplorer: BrainExplorer, neuronFigure: NeuronFigure, reflexArc: ReflexArc, spinalSection: SpinalSection }[block.type];
      return (
        <figure>
          <Suspense fallback={<div className="grid h-48 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری…</div>}>
            <C />
          </Suspense>
          <Caption text={block.caption} />
        </figure>
      );
    }
    case "coalIsotopes":
      return (
        <figure>
          <CoalIsotopeFigure image={asset(block.image)} />
          <Caption text={block.caption} />
        </figure>
      );
    case "isotopeCompare":
      return (
        <figure>
          <IsotopeCompare />
          <Caption text={block.caption} />
        </figure>
      );
    case "bohrFigure":
      return (
        <figure>
          <BohrFigure atoms={block.atoms} />
          <Caption text={block.caption} />
        </figure>
      );
    case "atomChoice":
      return (
        <figure>
          <AtomChoice options={block.options} />
          <Caption text={block.caption} />
        </figure>
      );
    case "periodicTable":
      return (
        <figure className="space-y-2">
          {block.title && <p className="font-bold">{block.title}</p>}
          <Suspense fallback={<div className="grid h-48 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری جدول…</div>}>
            <PeriodicTable highlight={block.highlight} />
          </Suspense>
          <Caption text={block.caption} />
        </figure>
      );
    case "atomCards":
      return (
        <figure>
          <Suspense fallback={<div className="grid h-72 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری…</div>}>
            <AtomCompare />
          </Suspense>
          <Caption text={block.caption} />
        </figure>
      );
    case "atom":
      return (
        <figure>
          <Suspense fallback={<div className="grid h-72 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800">در حال بارگذاری مدل سه‌بعدی…</div>}>
            <AtomExplorer initial={block.initial} elements={block.elements} ions={block.ions} />
          </Suspense>
          <Caption text={block.caption} />
        </figure>
      );
    case "quiz":
      return <Quiz title={block.title} questions={block.questions} />;
  }
}
