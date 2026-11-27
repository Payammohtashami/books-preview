import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Pause, Play, Tag } from "lucide-react";
import { LazyCanvas } from "./LazyCanvas";

const DURATION = 8;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type View = "neuron" | "nerve";
type V3 = [number, number, number];
interface Lbl { text: string; to: V3; off: [number, number]; color?: string }
interface Bridge { els: (HTMLElement | null)[]; lines: (SVGLineElement | null)[] }

/* ---------- یاخته‌ی عصبی ---------- */
const GREEN = "#62c24b", BLUE = "#4f93e8";
const SOMA: V3 = [-1.6, 0, 0];
const MYELIN_X = Array.from({ length: 8 }, (_, i) => -0.78 + i * 0.43);

/** دارینه‌های شاخه‌شاخه (ساخت یک‌باره و ادغام در یک هندسه)؛ مسیر یکی از دارینه‌ها هم برای پیام ثبت می‌شود */
function buildDendrites() {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const geos: THREE.BufferGeometry[] = [];
  const chain: THREE.Vector3[] = [];
  const grow = (o: THREE.Vector3, d: THREE.Vector3, len: number, r: number, depth: number, track: boolean) => {
    const mid = o.clone().addScaledVector(d, len * 0.5).add(new THREE.Vector3((rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12));
    const end = o.clone().addScaledVector(d, len);
    const c = new THREE.CatmullRomCurve3([o, mid, end]);
    geos.push(new THREE.TubeGeometry(c, 8, r, 6, false));
    const ball = new THREE.SphereGeometry(r * 1.0, 6, 5); ball.translate(end.x, end.y, end.z); geos.push(ball);
    if (track) chain.push(mid, end);
    if (depth <= 0) return;
    const n = depth > 1 ? 2 : 2 + (rnd() > 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const nd = d.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.1, (rnd() - 0.5) * 1.1, (rnd() - 0.5) * 0.9)).normalize();
      grow(end, nd, len * (0.62 + rnd() * 0.12), r * 0.72, depth - 1, track && i === 0);
    }
  };
  const roots: { a: number; len: number }[] = [
    { a: 2.45, len: 0.78 }, { a: 2.9, len: 0.8 }, { a: 3.4, len: 0.7 }, { a: 3.9, len: 0.8 }, { a: 4.35, len: 0.78 }, { a: 2.0, len: 0.55 },
  ];
  roots.forEach(({ a, len }, i) => {
    const d = new THREE.Vector3(Math.cos(a), Math.sin(a), (i % 3 - 1) * 0.28).normalize();
    const o = new THREE.Vector3(SOMA[0] + d.x * 0.42, SOMA[1] + d.y * 0.36, d.z * 0.36);
    if (i === 1) chain.push(o);
    grow(o, d, len, 0.055, 2, i === 1);
  });
  return { geo: mergeGeometries(geos)!, chain };
}

const DEND = buildDendrites();
/** مسیر پیام: نوک یک دارینه ← جسم یاخته‌ای ← آسه ← پایانه */
const PATH_PTS = [...[...DEND.chain].reverse(), new THREE.Vector3(...SOMA), new THREE.Vector3(-1.1, 0, 0), new THREE.Vector3(0.4, 0, 0), new THREE.Vector3(2.3, 0, 0), new THREE.Vector3(3.0, 0.45, 0.1)];
const PATH = new THREE.CatmullRomCurve3(PATH_PTS, false, "centripetal");
const PULSES = 4, TAIL = 4;
const K_SOMA = (() => { let best = 0, bd = 9; for (let i = 0; i <= 400; i++) { const d = PATH.getPointAt(i / 400).distanceTo(new THREE.Vector3(...SOMA)); if (d < bd) { bd = d; best = i / 400; } } return best; })();

/** پایانه‌های آسه */
const TERMINALS: V3[] = [[3.05, 0.62, 0.12], [3.25, 0.15, -0.08], [3.15, -0.38, 0.14], [2.95, -0.7, -0.1], [3.1, 0.3, 0.38]];

const NeuronScene = memo(function NeuronScene({ tRef }: { tRef: React.MutableRefObject<number> }) {
  const dend = DEND.geo;
  const axon = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-1.2, 0, 0), new THREE.Vector3(2.35, 0, 0)]), 40, 0.045, 8, false), []);
  const branches = useMemo(() => TERMINALS.map((p) => {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(2.3, 0, 0), new THREE.Vector3(2.7, p[1] * 0.3, p[2] * 0.3), new THREE.Vector3(...p));
    return new THREE.TubeGeometry(c, 14, 0.035, 6, false);
  }), []);
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  const soma = useRef<THREE.MeshStandardMaterial>(null);
  const nucl = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const t = tRef.current;
    let near = 0;
    for (let i = 0; i < PULSES; i++) {
      const k0 = (((t - i / PULSES) % 1) + 1) % 1;
      for (let j = 0; j < TAIL; j++) {
        const m = beads.current[i * TAIL + j];
        if (!m) continue;
        const k = k0 - j * 0.016;
        m.visible = t > 0.001 && k > 0.005 && k < 0.995;
        if (!m.visible) continue;
        m.position.copy(PATH.getPointAt(k));
        const edge = Math.min(1, k / 0.04, (1 - k) / 0.04);
        m.scale.setScalar(Math.max(0.05, edge) * (1 - j * 0.17) * (j === 0 ? 1 + 0.12 * Math.sin(performance.now() / 90) : 1));
        if (j === 0) near += Math.exp(-Math.pow((k - K_SOMA) / 0.05, 2));
      }
    }
    near = Math.min(1, near);
    if (soma.current) soma.current.emissiveIntensity = 0.4 * near;
    if (nucl.current) nucl.current.emissiveIntensity = 0.6 * near;
  });

  return (
    <>
      {/* دارینه‌ها */}
      <mesh geometry={dend}><meshStandardMaterial color={GREEN} roughness={0.45} metalness={0.05} /></mesh>
      {/* جسم یاخته‌ای */}
      <mesh position={SOMA} scale={[0.6, 0.48, 0.48]}>
        <sphereGeometry args={[1, 40, 30]} />
        <meshStandardMaterial ref={soma} color="#cbd3dd" emissive="#fde047" emissiveIntensity={0} roughness={0.35} metalness={0.1} transparent opacity={0.82} depthWrite={false} />
      </mesh>
      <mesh position={[SOMA[0] + 0.05, 0, 0]}>
        <sphereGeometry args={[0.2, 24, 18]} />
        <meshStandardMaterial ref={nucl} color="#3f4b61" emissive="#fde047" emissiveIntensity={0} roughness={0.6} />
      </mesh>
      {/* آسه */}
      <mesh geometry={axon}><meshStandardMaterial color={BLUE} roughness={0.35} /></mesh>
      {/* غلاف میلین */}
      {MYELIN_X.map((x) => (
        <mesh key={x} position={[x, 0, 0]} scale={[0.27, 0.115, 0.115]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color="#f6d9a6" roughness={0.45} transparent opacity={0.78} />
        </mesh>
      ))}
      {/* پایانه‌ها */}
      {branches.map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color={BLUE} roughness={0.35} /></mesh>)}
      {TERMINALS.map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.085, 14, 12]} /><meshStandardMaterial color="#9fc5f6" roughness={0.3} /></mesh>
      ))}
      {/* مجموعه‌ی پیام‌های عصبی پشت سر هم */}
      {Array.from({ length: PULSES * TAIL }, (_, n) => {
        const j = n % TAIL;
        return (
          <mesh key={n} ref={(el) => { beads.current[n] = el; }} visible={false} renderOrder={10}>
            <sphereGeometry args={[j === 0 ? 0.14 : 0.1, 14, 10]} />
            <meshBasicMaterial color={j === 0 ? "#fff59a" : "#ffd21f"} transparent opacity={j === 0 ? 1 : 0.8 - j * 0.15} depthTest={false} />
          </mesh>
        );
      })}
    </>
  );
});

/* ---------- عصب ---------- */
const FIBERS: { y: number; z: number; sensory: boolean }[] = (() => {
  const a: { y: number; z: number; sensory: boolean }[] = [{ y: 0, z: 0, sensory: true }];
  for (let i = 0; i < 6; i++) { const ang = (i / 6) * Math.PI * 2 + 0.3; a.push({ y: Math.cos(ang) * 0.5, z: Math.sin(ang) * 0.5, sensory: i % 2 === 1 }); }
  return a;
})();
const NERVE_L = 4.4;

const NerveScene = memo(function NerveScene({ tRef }: { tRef: React.MutableRefObject<number> }) {
  const beads = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const t = tRef.current;
    FIBERS.forEach((f, i) => {
      const m = beads.current[i];
      if (!m) return;
      const k = (t * 1.6 + i * 0.17) % 1;
      m.position.x = f.sensory ? lerp(NERVE_L / 2, -NERVE_L / 2, k) : lerp(-NERVE_L / 2, NERVE_L / 2, k);
      m.visible = t > 0.001;
    });
  });
  return (
    <group>
      {/* غلاف */}
      <mesh rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.95, 0.95, NERVE_L, 56, 1, true]} />
        <meshStandardMaterial color="#f3cf93" roughness={0.45} transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[NERVE_L / 2, 0, 0]} rotation-y={Math.PI / 2}>
        <torusGeometry args={[0.95, 0.035, 10, 56]} />
        <meshStandardMaterial color="#d6a45f" roughness={0.5} />
      </mesh>
      {/* تارها */}
      {FIBERS.map((f, i) => (
        <group key={i} position={[0, f.y, f.z]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.17, 0.17, NERVE_L, 28]} />
            <meshStandardMaterial color={f.sensory ? BLUE : "#fb8a3c"} roughness={0.35} />
          </mesh>
          <mesh ref={(el) => { beads.current[i] = el; }} position={[0, 0, 0]}>
            <sphereGeometry args={[0.2, 14, 10]} />
            <meshStandardMaterial color="#fff7c2" emissive="#fde047" emissiveIntensity={1.4} transparent opacity={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
});

/* ---------- برچسب‌ها ---------- */
const LABELS: Record<View, Lbl[]> = {
  neuron: [
    { text: "دارینه (دندریت)", to: [DEND.chain[2].x, DEND.chain[2].y, DEND.chain[2].z], off: [-0.04, -0.22], color: GREEN },
    { text: "جسم یاخته‌ای", to: [-1.6, -0.42, 0.2], off: [0, 0.28], color: "#cbd3dd" },
    { text: "هسته", to: [-1.55, 0.1, 0.22], off: [0.02, -0.3], color: "#cbd3dd" },
    { text: "آسه (آکسون)", to: [1.4, 0.06, 0], off: [0, -0.26], color: BLUE },
    { text: "غلاف", to: [0.09, -0.1, 0.05], off: [-0.02, 0.26], color: "#f6d9a6" },
    { text: "پایانه‌ی آسه", to: [3.1, -0.4, 0.14], off: [0, 0.24], color: "#9fc5f6" },
  ],
  nerve: [
    { text: "غلاف عصب", to: [0, 0.95, 0], off: [-0.12, -0.2], color: "#f6d9a6" },
    { text: "تار عصبی", to: [NERVE_L / 2, FIBERS[2].y, FIBERS[2].z], off: [0.04, -0.3], color: "#fff" },
    { text: "تار حسی", to: [-1.1, 0, 0.17], off: [-0.18, 0.3], color: BLUE },
    { text: "تار حرکتی", to: [-0.4, FIBERS[2].y, FIBERS[2].z + 0.17], off: [0.2, 0.28], color: "#fb8a3c" },
  ],
};

const CAMERAS: Record<View, { pos: V3; target: V3 }> = {
  neuron: { pos: [0.2, 0.9, 6.3], target: [0.1, 0, 0] },
  nerve: { pos: [4.6, 1.9, 3.5], target: [0, 0, 0] },
};

const tmpV = new THREE.Vector3();

function Rig({ view }: { view: View }) {
  const camera = useThree((s) => s.camera);
  const c = CAMERAS[view];
  useEffect(() => { camera.position.set(...c.pos); camera.lookAt(...c.target); }, [camera, c]);
  return <OrbitControls key={view} makeDefault enablePan={false} target={c.target} minDistance={3} maxDistance={11} />;
}

function Scene({ view, tRef, bridge }: { view: View; tRef: React.MutableRefObject<number>; bridge: React.MutableRefObject<Bridge> }) {
  useFrame(({ camera, size }) => {
    const { els, lines } = bridge.current;
    LABELS[view].forEach((l, i) => {
      const el = els[i], ln = lines[i];
      if (!el || !ln) return;
      tmpV.set(...l.to).project(camera);
      const ax = ((tmpV.x + 1) / 2) * size.width, ay = ((1 - tmpV.y) / 2) * size.height;
      const lx = Math.min(size.width - 50, Math.max(50, ax + l.off[0] * size.width)), ly = Math.min(size.height - 16, Math.max(16, ay + l.off[1] * size.height));
      el.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -50%)`;
      ln.setAttribute("x1", String(lx)); ln.setAttribute("y1", String(ly)); ln.setAttribute("x2", String(ax)); ln.setAttribute("y2", String(ay));
    });
  });
  return (
    <>
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#ffffff", "#40506e", 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#b9d0ff" />
      <Rig view={view} />
      {view === "neuron" && <NeuronScene tRef={tRef} />}
      {view === "nerve" && <NerveScene tRef={tRef} />}
    </>
  );
}

const INFO: Record<View, string> = {
  neuron: "پیام‌های عصبی یکی پس از دیگری از دارینه‌ها دریافت می‌شوند، از جسم یاخته‌ای می‌گذرند و از راه آسه به پایانه‌ها می‌رسند و به یاخته‌های دیگر (عصبی، ماهیچه‌ای…) منتقل می‌شوند. غلاف دور آسه را گرفته است.",
  nerve: "عصب مجموعه‌ای از تارهای عصبی است که در کنار هم قرار دارند و غلافی آن‌ها را احاطه کرده است. تارهای حسی پیام را به مراکز عصبی و تارهای حرکتی پیام را از مراکز عصبی به اندام‌ها می‌برند.",
};

/** یاخته‌ی عصبی، و عصب (شکل ۹ کتاب) به‌صورت سه‌بعدی. */
export default function NeuronFigure() {
  const [view, setView] = useState<View>("neuron");
  const [playing, setPlaying] = useState(false);
  const [names, setNames] = useState(true);
  const tRef = useRef(0);
  const playRef = useRef(false);
  playRef.current = playing;
  const bridge = useRef<Bridge>({ els: [], lines: [] });
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const n = box.current;
    if (!n) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(n);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playRef.current) tRef.current += dt / DURATION;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const toggle = () => setPlaying((p) => !p);
  const pick = (v: View) => { setView(v); tRef.current = 0; setPlaying(false); };
  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm ${on ? "bg-amber-400 font-bold text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`;
  const labels = LABELS[view];

  const overlay = (
    <div className="pointer-events-none absolute inset-0" style={{ direction: "ltr" }}>
      {names && (
        <>
          <svg className="absolute inset-0 size-full">
            {labels.map((l, i) => <line key={view + i} ref={(el) => { bridge.current.lines[i] = el; }} stroke={l.color ?? "#fff"} strokeOpacity="0.7" strokeWidth="1.2" />)}
          </svg>
          {labels.map((l, i) => (
            <span key={view + i} ref={(el) => { bridge.current.els[i] = el; }} className="absolute left-0 top-0 whitespace-nowrap rounded-full border bg-slate-950/80 px-2.5 py-0.5 text-xs font-bold text-white md:text-sm" style={{ borderColor: l.color ?? "#fff", direction: "rtl" }}>
              {l.text}
            </span>
          ))}
        </>
      )}
      {labels.length > 0 && (
        <button type="button" onClick={() => setNames((v) => !v)} aria-pressed={names} className="pointer-events-auto absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950" style={{ direction: "rtl" }}>
          <Tag className="size-3.5" aria-hidden="true" /> نام‌ها
        </button>
      )}
      <span className="absolute bottom-2 left-3 text-[11px] text-slate-400" style={{ direction: "rtl" }}>بکشید تا بچرخد</span>
    </div>
  );

  return (
    <div ref={box} className="space-y-3 rounded-2xl bg-slate-900 p-3 text-slate-100">
      <div className="flex flex-wrap gap-2">
        <button className={tab(view === "neuron")} onClick={() => pick("neuron")}>یاخته‌ی عصبی</button>
        <button className={tab(view === "nerve")} onClick={() => pick("nerve")}>عصب</button>
      </div>
      <LazyCanvas key={view} camera={{ position: CAMERAS[view].pos, fov: 38 }} label="مدل سه‌بعدی یاخته‌ی عصبی و عصب" overlay={overlay} className="h-[22rem] md:h-[28rem]">
        <Scene view={view} tRef={tRef} bridge={bridge} />
      </LazyCanvas>
      {view === "neuron" && (
        <div dir="ltr" className="flex h-7 overflow-hidden rounded-md text-center text-xs font-bold leading-7 text-slate-900" aria-hidden="true">
          <span className="basis-[22%] bg-[#62c24b]">دارینه</span>
          <span className="basis-[16%] bg-slate-300">جسم یاخته‌ای</span>
          <span className="flex-1 bg-[#4f93e8]">آسه ←</span>
        </div>
      )}
      <p className="min-h-[3rem] rounded-xl bg-white/5 px-3 py-2 text-sm leading-7" aria-live="polite">
        {INFO[view]}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-1.5 text-sm font-semibold text-slate-950">
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          {playing ? "توقف" : "شروع"}
        </button>
      </div>
    </div>
  );
}
