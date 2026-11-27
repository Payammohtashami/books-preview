import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import { ELEMENTS, fillShells, nucleusLayout } from "./atoms";
import { Nuclide } from "./Inline";
import { toFa } from "@/lib/fa";
import { Circle, Eye, EyeOff, Pause, Play } from "lucide-react";

const RING_RADII = [1.25, 2.0, 2.75];
const SPEEDS = [1.1, 0.7, 0.45];
const LABEL_ANGLES = [2.2, 2.9, 0.6];
const TILTS: [number, number][] = [[0.0, 0.0], [0.3, 0.25], [-0.25, 0.4]];

function Ring({ radius }: { radius: number }) {
  const pts = useMemo(
    () => Array.from({ length: 97 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2;
      return [Math.cos(a) * radius, 0, Math.sin(a) * radius] as [number, number, number];
    }),
    [radius],
  );
  return <Line points={pts} color="#38bdf8" lineWidth={1.5} transparent opacity={0.85} />;
}

function Shell({ index, count, playing, labels }: { index: number; count: number; playing: boolean; labels: boolean }) {
  const radius = RING_RADII[index];
  const refs = useRef<(Group | null)[]>([]);
  const t = useRef(index * 1.3);

  useFrame((_, dt) => {
    if (playing) t.current += dt * SPEEDS[index];
    for (let i = 0; i < count; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const a = t.current + (i / count) * Math.PI * 2;
      g.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
  });

  return (
    <group rotation={[TILTS[index][0], 0, TILTS[index][1]]}>
      <Ring radius={radius} />
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh>
            <sphereGeometry args={[0.13, 20, 20]} />
            <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {labels && (
        <Html position={[Math.cos(LABEL_ANGLES[index]) * radius, 0.15, Math.sin(LABEL_ANGLES[index]) * radius]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
          <span className="whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-800 shadow">
            مدار {toFa(index + 1)}
          </span>
        </Html>
      )}
    </group>
  );
}

function Nucleus({ protons, neutrons, baseNeutrons, labels }: { protons: number; neutrons: number; baseNeutrons: number; labels: boolean }) {
  const { particles, radius, unit } = useMemo(() => nucleusLayout(protons, neutrons, baseNeutrons), [protons, neutrons, baseNeutrons]);
  return (
    <group>
      {particles.map((p, i) => (
        <mesh key={i} position={p.pos}>
          <sphereGeometry args={[unit, 24, 24]} />
          <meshStandardMaterial color={p.proton ? "#ef4444" : p.extra ? "#4ade80" : "#9ca3af"} emissive={p.extra ? "#16a34a" : "#000000"} emissiveIntensity={p.extra ? 0.5 : 0} roughness={0.45} />
        </mesh>
      ))}
      {labels && (
        <Html position={[0, -radius - 0.25, 0]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
          <span className="whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] text-slate-800 shadow">
            هسته (پروتون و نوترون)
          </span>
        </Html>
      )}
    </group>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

interface Props {
  initial: string;
  elements: string[];
  ions?: boolean;
}

/** مدل سه‌بعدی بور: هسته (پروتون و نوترون) و الکترون‌هایی که در مدارها می‌چرخند. */
export default function AtomExplorer({ initial, elements, ions = false }: Props) {
  const [symbol, setSymbol] = useState(initial);
  const el = ELEMENTS[symbol];
  const [mass, setMass] = useState<number | null>(null);
  const [asIon, setAsIon] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [labels, setLabels] = useState(true);
  const [visible, setVisible] = useState(false);
  const [everVisible, setEverVisible] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [webgl] = useState(hasWebGL);
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setEverVisible(true);
    }, { rootMargin: "100px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const canIon = ions && (symbol === "Na" || symbol === "Cl");
  const ionCharge = canIon && asIon ? (symbol === "Na" ? 1 : -1) : 0;

  const neutrons = mass != null && el.isotopes?.includes(mass) ? mass - el.z : el.n;
  const protons = el.z;
  const baseNeutrons = el.isotopes ? el.isotopes[0] - el.z : el.n;
  const electrons = protons - ionCharge;
  const massNumber = protons + neutrons;
  const shells = fillShells(electrons);

  const chooseElement = (s: string) => {
    setSymbol(s);
    setMass(null);
    setAsIon(false);
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition ${
      active
        ? "border-brand-700 bg-brand-700 text-white"
        : "border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
    }`;

  const chargeText = ionCharge === 0 ? "۰ (خنثی)" : ionCharge > 0 ? `+${toFa(ionCharge)}` : `−${toFa(-ionCharge)}`;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2" role="group" aria-label="انتخاب عنصر">
        {elements.map((s) => (
          <button key={s} className={chip(s === symbol)} onClick={() => chooseElement(s)} aria-pressed={s === symbol}>
            <span className="ltr inline-block font-semibold">{s}</span> <span className="text-xs opacity-80">{ELEMENTS[s].name}</span>
          </button>
        ))}
      </div>

      {el.isotopes && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="ایزوتوپ">
          <span className="text-sm text-slate-600 dark:text-slate-400">ایزوتوپ:</span>
          {el.isotopes.map((m) => (
            <button key={m} className={chip(massNumber === m)} onClick={() => setMass(m)} aria-pressed={massNumber === m}>
              {el.name} {toFa(m)}
            </button>
          ))}
        </div>
      )}

      {canIon && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="اتم یا یون">
          <button className={chip(!asIon)} onClick={() => setAsIon(false)} aria-pressed={!asIon}>اتم</button>
          <button className={chip(asIon)} onClick={() => setAsIon(true)} aria-pressed={asIon}>
            {symbol === "Na" ? "یون سدیم (از دست دادن الکترون)" : "یون کلرید (گرفتن الکترون)"}
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <div ref={boxRef} className="relative h-[22rem] overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 md:h-[26rem]">
          {!webgl && (
            <p role="alert" className="grid h-full place-items-center p-4 text-center text-sm text-white">
              مرورگر شما از گرافیک سه‌بعدی (WebGL) پشتیبانی نمی‌کند. اطلاعات اتم در کادر کناری نمایش داده می‌شود.
            </p>
          )}
          {webgl && everVisible && (
            <Canvas
              key={shells.length}
              dpr={[1, 2]}
              frameloop={visible ? "always" : "never"}
              camera={{ position: [0, [3, 4.5, 6][Math.max(0, shells.length - 1)], [5, 7, 9.2][Math.max(0, shells.length - 1)]], fov: 45 }}
              aria-label={`مدل سه‌بعدی اتم ${el.name}`}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[4, 5, 3]} intensity={1.6} />
              <Nucleus protons={protons} neutrons={neutrons} baseNeutrons={baseNeutrons} labels={labels} />
              {shells.map((c, i) => (
                <Shell key={`${symbol}-${electrons}-${i}`} index={i} count={c} playing={playing} labels={labels} />
              ))}
              <OrbitControls enablePan={false} minDistance={3} maxDistance={14} />
            </Canvas>
          )}
          <div className="absolute bottom-2 start-2 flex gap-2">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1 text-xs text-slate-900 shadow"
              aria-pressed={playing}
            >
              {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
              {playing ? "توقف چرخش" : "ادامه‌ی چرخش"}
            </button>
            <button
              onClick={() => setLabels((l) => !l)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1 text-xs text-slate-900 shadow"
              aria-pressed={labels}
            >
              {labels ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
              {labels ? "پنهان‌کردن برچسب‌ها" : "نمایش برچسب‌ها"}
            </button>
          </div>
          <p className="pointer-events-none absolute end-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[11px] text-white">
            بکشید تا بچرخد؛ با دو انگشت بزرگ کنید
          </p>
        </div>

        <aside className="space-y-2 rounded-xl bg-white p-3 text-sm dark:bg-slate-800" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-2xl">
              {ionCharge === 0 ? (
                <Nuclide sym={el.symbol} a={String(massNumber)} z={String(protons)} />
              ) : (
                <span className="ltr font-semibold" dir="ltr">{el.symbol}<sup>{ionCharge > 0 ? "+" : "−"}</sup></span>
              )}
            </span>
            <span className="font-bold">{ionCharge === 0 ? el.name : symbol === "Na" ? "یون سدیم" : "یون کلرید"}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>عدد اتمی</dt><dd className="font-semibold">{toFa(protons)}</dd>
            <dt className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400"><Circle className="size-3 fill-current" aria-hidden="true" /> پروتون</dt><dd className="font-semibold">{toFa(protons)}</dd>
            <dt className="inline-flex items-center gap-1.5 text-slate-500"><Circle className="size-3 fill-current" aria-hidden="true" /> نوترون</dt><dd className="font-semibold">{toFa(neutrons)}</dd>
            <dt className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400"><Circle className="size-3 fill-current" aria-hidden="true" /> الکترون</dt><dd className="font-semibold">{toFa(electrons)}</dd>
            {el.isotopes && <><dt className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400"><Circle className="size-3 fill-current" aria-hidden="true" /> نوترون اضافه</dt><dd className="font-semibold">{toFa(Math.max(0, neutrons - baseNeutrons))}</dd></>}
            <dt>عدد جرمی</dt><dd className="font-semibold">{toFa(massNumber)}</dd>
            <dt>بار الکتریکی</dt><dd className="font-semibold">{chargeText}</dd>
            <dt>الکترون در مدارها</dt><dd className="font-semibold">{shells.map((s) => toFa(s)).join("، ")}</dd>
          </dl>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            در مدل بور، مدار اول حداکثر ۲ الکترون و مدار دوم حداکثر ۸ الکترون دارد.
          </p>
        </aside>
      </div>
    </div>
  );
}
