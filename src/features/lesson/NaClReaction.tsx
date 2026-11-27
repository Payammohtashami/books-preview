import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { toFa } from "@/lib/fa";
import { Pause, Play, RotateCcw } from "lucide-react";

/* ───────── حرکت ذره‌ها: همه‌چیز تابعی از زمان شبیه‌سازی (ثانیه) است تا لغزنده کار کند ───────── */
const DURATION = 13; // ثانیه‌ی کل شبیه‌سازی
const CONTACT = 1.3; // نیم‌فاصله‌ی دو اتم هنگام برخورد
const HOLD = 1.6; // مدت ماندن دو اتم کنار هم برای انتقال الکترون
const SP = 2.0; // فاصله‌ی یون‌ها در بلور

type V3 = [number, number, number];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// سه خوشه‌ی بلوری که در سه جای مختلف ساخته می‌شوند
const CLUSTERS = [
  { c: [-4.2, 0, 0] as V3, rot: [0.35, 0.6, 0.1] as V3 },
  { c: [4.6, -0.2, 0.3] as V3, rot: [-0.3, -0.5, 0.2] as V3 },
  { c: [0, -0.3, 0.4] as V3, rot: [0.1, 0.3, 0] as V3 },
];
const slot = (cluster: number, cell: [number, number]): V3 => {
  const { c, rot } = CLUSTERS[cluster];
  const v = new THREE.Vector3((cell[0] - 0.5) * SP, (cell[1] - 0.5) * SP, 0).applyEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  return [c[0] + v.x, c[1] + v.y, c[2] + v.z];
};

// ۵ جفت Na–Cl واکنش می‌دهند (هرکدام در زمان و جای خودش)؛ ۳ Na و ۳ Cl بی‌جفت می‌مانند و خنثی‌اند
const PAIRS = [
  { cluster: 0, naCell: [0, 0], clCell: [1, 0], tm: 3.0, m: [-5.8, 2.8, 0], d: [1, 0.15, 0.2], travel: 3.4, naHome: [-7.5, 2.0, -1], clHome: [-4, 3.4, 1] },
  { cluster: 0, naCell: [1, 1], clCell: [0, 1], tm: 5.0, m: [-5.2, -2.9, 0.2], d: [1, -0.1, 0.1], travel: 3.0, naHome: [-7.2, -2.4, 1.5], clHome: [-3.4, -3.4, -1] },
  { cluster: 1, naCell: [0, 0], clCell: [1, 0], tm: 4.0, m: [5.8, 2.9, -0.2], d: [0.9, 0.3, 0.2], travel: 3.6, naHome: [4, 3.4, -1.2], clHome: [7.6, 2.0, 1.2] },
  { cluster: 1, naCell: [1, 1], clCell: [0, 1], tm: 6.6, m: [5.5, -3.0, 0], d: [1, 0, 0.3], travel: 3.0, naHome: [7.4, -2.6, -1.2], clHome: [3.6, -3.3, 1.2] },
  { cluster: 2, naCell: [0, 0.5], clCell: [1, 0.5], tm: 5.8, m: [0, 3.3, 0], d: [1, 0.1, 0], travel: 3.4, naHome: [-1.6, 3.0, 1], clHome: [1.6, 3.5, -0.8] },
].map((p) => {
  const d = new THREE.Vector3(...(p.d as V3)).normalize();
  return {
    ...p,
    naContact: [p.m[0] - d.x * CONTACT, p.m[1] - d.y * CONTACT, p.m[2] - d.z * CONTACT] as V3,
    clContact: [p.m[0] + d.x * CONTACT, p.m[1] + d.y * CONTACT, p.m[2] + d.z * CONTACT] as V3,
    naSlot: slot(p.cluster, p.naCell as [number, number]),
    clSlot: slot(p.cluster, p.clCell as [number, number]),
    tc: p.tm + 1.15, // لحظه‌ی تبدیل به یون
    arrive: p.tm + HOLD + p.travel,
  };
});
const N_PAIRS = PAIRS.length;
const HOMES = {
  Na: [...PAIRS.map((p) => p.naHome as V3), [0, -3.3, -1.8], [2, 1.8, -2.2], [-7.6, 0.2, -2]] as V3[],
  Cl: [...PAIRS.map((p) => p.clHome as V3), [-2.2, -1.6, -2.2], [1.2, -3.2, 2], [7.8, -0.4, -2]] as V3[],
};
const N_ATOMS = 8;

const wander = (kind: "Na" | "Cl", i: number, time: number, amp: number): V3 => {
  const f = i * 1.7 + (kind === "Na" ? 0 : 3.1);
  return [
    (Math.sin(time * 0.71 + f) + 0.5 * Math.sin(time * 1.37 + f * 2)) * amp,
    (Math.sin(time * 0.57 + f * 1.3) + 0.5 * Math.sin(time * 1.11 + f)) * amp * 0.7,
    (Math.sin(time * 0.63 + f * 0.7) + 0.5 * Math.cos(time * 1.23 + f * 1.5)) * amp * 0.8,
  ];
};

function positionAt(kind: "Na" | "Cl", i: number, time: number): V3 {
  const home = HOMES[kind][i];
  if (i >= N_PAIRS) {
    const w = wander(kind, i, time, 0.9);
    return [home[0] + w[0], home[1] + w[1], home[2] + w[2]];
  }
  const p = PAIRS[i];
  const contact = kind === "Na" ? p.naContact : p.clContact;
  const final = kind === "Na" ? p.naSlot : p.clSlot;
  let base: V3;
  let amp: number;
  if (time < p.tm) {
    const s = smooth(time / p.tm);
    base = lerp(home, contact, s);
    amp = (1 - s) * 0.9;
  } else if (time < p.tm + HOLD) {
    base = contact;
    amp = 0;
  } else {
    const s = smooth(clamp((time - p.tm - HOLD) / p.travel));
    base = lerp(contact, final, s);
    amp = Math.sin(Math.PI * s) * 0.25;
  }
  const w = wander(kind, i, time, amp);
  const settled = time >= p.arrive ? 0.03 : 0;
  return [base[0] + w[0] + Math.sin(time * 9 + i) * settled, base[1] + w[1] + Math.cos(time * 8 + i) * settled, base[2] + w[2]];
}

/* ───────── برچسب‌ها (بافت بوم، بدون نیاز به فونت یا اینترنت) ───────── */
function labelTexture(sym: string, charge: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "700 72px sans-serif";
  g.textBaseline = "middle";
  const w = g.measureText(sym).width;
  g.font = "700 44px sans-serif";
  const cw = charge ? g.measureText(charge).width : 0;
  const x0 = (256 - (w + cw)) / 2;
  g.fillStyle = "rgba(15,23,42,0.78)";
  g.beginPath();
  g.roundRect(x0 - 18, 24, w + cw + 36, 80, 22);
  g.fill();
  g.fillStyle = color;
  g.font = "700 72px sans-serif";
  g.fillText(sym, x0, 68);
  if (charge) {
    g.font = "700 44px sans-serif";
    g.fillText(charge, x0 + w + 2, 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ───────── اتم/یون با مدارها و الکترون‌ها ───────── */
const SHELL_R = { Na: [0.4, 0.74, 1.08], Cl: [0.38, 0.68, 0.96] } as const;
const COLORS = {
  Na: { nucleus: "#fb923c", ring: "#cbd5e1", label: "#fdba74" },
  Cl: { nucleus: "#facc15", ring: "#86efac", label: "#bef264" },
};

function ringPoints(r: number) {
  return Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as V3;
  });
}

const texCache: Record<string, THREE.Texture> = {};
const tex = (sym: string, charge: string, color: string) => (texCache[sym + charge] ??= labelTexture(sym, charge, color));

function Ion({ kind, i, prog }: { kind: "Na" | "Cl"; i: number; prog: React.RefObject<number> }) {
  const root = useRef<THREE.Group>(null);
  const outerRing = useRef<THREE.Group>(null);
  const spinners = useRef<(THREE.Group | null)[]>([]);
  const extraE = useRef<THREE.Mesh>(null);
  const naOuterE = useRef<THREE.Mesh>(null);
  const sprite = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Mesh>(null);
  const r = SHELL_R[kind];
  const counts = kind === "Na" ? [2, 8, 1] : [2, 8, 7];
  const col = COLORS[kind];
  const pair = i < N_PAIRS ? PAIRS[i] : null;
  const atomTex = tex(kind, "", col.label);
  const ionTex = kind === "Na" ? tex("Na", "+", "#7dd3fc") : tex("Cl", "−", "#fca5a5");

  useFrame((_, dt) => {
    const time = (prog.current ?? 0) * DURATION;
    const g = root.current;
    if (!g) return;
    const p = positionAt(kind, i, time);
    g.position.set(p[0], p[1], p[2]);
    spinners.current.forEach((s, k) => {
      if (s) s.rotation.y += dt * (1.6 - k * 0.45);
    });
    if (kind === "Na") {
      if (naOuterE.current) naOuterE.current.visible = !pair || time < pair.tm + 0.25;
      if (outerRing.current) outerRing.current.scale.setScalar(pair ? 1 - smooth(clamp((time - pair.tm - 0.9) / 0.5)) * 0.999 : 1);
    } else if (extraE.current) {
      const s = pair ? smooth(clamp((time - pair.tm - 1.0) / 0.3)) : 0;
      extraE.current.scale.setScalar(Math.max(0.0001, s));
      extraE.current.visible = s > 0.01;
    }
    const ionic = !!pair && time >= pair.tc;
    if (sprite.current) {
      const m = sprite.current.material as THREE.SpriteMaterial;
      const next = ionic ? ionTex : atomTex;
      if (m.map !== next) {
        m.map = next;
        m.needsUpdate = true;
      }
      sprite.current.position.y = (ionic && kind === "Na" ? r[1] : r[2]) + 0.45;
    }
    if (halo.current) {
      const s = pair ? smooth(clamp((time - pair.tc) / 0.5)) : 0;
      halo.current.visible = s > 0.01;
      (halo.current.material as THREE.MeshBasicMaterial).opacity = s * 0.2;
      halo.current.scale.setScalar(kind === "Na" ? 0.85 : 1.1);
    }
  });

  const shell = (k: number) => {
    const count = counts[k] + (kind === "Cl" && k === 2 ? 1 : 0);
    const radius = r[k];
    return (
      <group key={k} ref={k === 2 && kind === "Na" ? outerRing : undefined} rotation={[0.22 * (k - 1), 0, 0.18 * k]}>
        <Line points={ringPoints(radius)} color={col.ring} lineWidth={1} transparent opacity={0.5} />
        <group ref={(el) => { spinners.current[k] = el; }}>
          {Array.from({ length: count }, (_, j) => {
            const a = (j / count) * Math.PI * 2 + k * 0.8;
            const isExtra = kind === "Cl" && k === 2 && j === count - 1;
            const isNaOuter = kind === "Na" && k === 2;
            return (
              <mesh key={j} ref={isExtra ? extraE : isNaOuter ? naOuterE : undefined} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshStandardMaterial color={isExtra || isNaOuter ? "#f472b6" : "#38bdf8"} emissive={isExtra || isNaOuter ? "#ec4899" : "#0ea5e9"} emissiveIntensity={0.7} roughness={0.3} />
              </mesh>
            );
          })}
        </group>
      </group>
    );
  };

  return (
    <group ref={root}>
      <mesh ref={halo} visible={false}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshBasicMaterial color={kind === "Na" ? "#38bdf8" : "#f87171"} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.23, 20, 20]} />
        <meshStandardMaterial color={col.nucleus} emissive={col.nucleus} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {[0, 1, 2].map(shell)}
      <sprite ref={sprite} scale={[1.05, 0.52, 1]} renderOrder={10}>
        <spriteMaterial map={atomTex} transparent depthWrite={false} depthTest={false} />
      </sprite>
    </group>
  );
}

/** الکترونی که از Na به Cl می‌پرد (با برچسب e⁻) و جرقه‌ی آزادشدن انرژی؛ برای هر جفت در زمان خودش. */
function Transfer({ i, prog }: { i: number; prog: React.RefObject<number> }) {
  const e = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const p = PAIRS[i];
  const eTex = tex("e", "−", "#f9a8d4");
  useFrame(() => {
    const time = (prog.current ?? 0) * DURATION;
    const k = clamp((time - p.tm - 0.2) / 0.9);
    const na = positionAt("Na", i, time);
    const cl = positionAt("Cl", i, time);
    const from: V3 = [na[0] + SHELL_R.Na[2], na[1], na[2]];
    const to: V3 = [cl[0] - SHELL_R.Cl[2], cl[1], cl[2]];
    if (e.current) {
      e.current.visible = k > 0 && k < 1;
      const s = smooth(k);
      e.current.position.set(from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s + Math.sin(Math.PI * s) * 0.5, from[2] + (to[2] - from[2]) * s);
    }
    if (flash.current) {
      const f = clamp((time - p.tm - 1.05) / 0.5);
      flash.current.visible = f > 0 && f < 1;
      flash.current.position.set(to[0], to[1], to[2]);
      flash.current.scale.setScalar(0.3 + f * 1.8);
      (flash.current.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.6;
    }
  });
  return (
    <>
      <group ref={e} visible={false}>
        <mesh>
          <sphereGeometry args={[0.14, 14, 14]} />
          <meshStandardMaterial color="#f472b6" emissive="#ec4899" emissiveIntensity={1.4} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.32, 14, 14]} />
          <meshBasicMaterial color="#f472b6" transparent opacity={0.22} depthWrite={false} />
        </mesh>
        <sprite position={[0, 0.5, 0]} scale={[0.7, 0.35, 1]} renderOrder={11}>
          <spriteMaterial map={eTex} transparent depthWrite={false} depthTest={false} />
        </sprite>
      </group>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, 20, 20]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  );
}

/** پیوندهای یونی: وقتی هر دو یون همسایه به جای خود رسیدند پدیدار می‌شوند. */
const BONDS: { a: number; b: number }[] = [
  { a: 0, b: 0 }, { a: 0, b: 1 }, { a: 1, b: 0 }, { a: 1, b: 1 }, // خوشه‌ی ۱ (Na_a با Cl_b)
  { a: 2, b: 2 }, { a: 2, b: 3 }, { a: 3, b: 2 }, { a: 3, b: 3 }, // خوشه‌ی ۲
  { a: 4, b: 4 }, // خوشه‌ی ۳
];
function Bonds({ prog }: { prog: React.RefObject<number> }) {
  const mats = useRef<THREE.Material[]>([]);
  useFrame(() => {
    const time = (prog.current ?? 0) * DURATION;
    BONDS.forEach((bd, k) => {
      const m = mats.current[k];
      if (m) m.opacity = clamp((time - Math.max(PAIRS[bd.a].arrive, PAIRS[bd.b].arrive) + 0.2) / 0.8) * 0.7;
    });
  });
  return (
    <>
      {BONDS.map((bd, k) => (
        <Line
          key={k}
          points={[PAIRS[bd.a].naSlot, PAIRS[bd.b].clSlot]}
          color="#e2e8f0"
          lineWidth={1.6}
          transparent
          opacity={0}
          ref={(el: unknown) => { const l = el as { material?: THREE.Material } | null; if (l?.material) mats.current[k] = l.material; }}
        />
      ))}
    </>
  );
}

function Scene({ prog, playing, onTick }: { prog: React.RefObject<number>; playing: boolean; onTick: (t: number) => void }) {
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (playing && prog.current! < 1) prog.current = Math.min(1, prog.current! + dt / DURATION);
    acc.current += dt;
    if (acc.current > 0.05) {
      acc.current = 0;
      onTick(prog.current!);
    }
  });
  const ids = Array.from({ length: N_ATOMS }, (_, i) => i);
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} />
      {ids.map((i) => (
        <group key={i}>
          <Ion kind="Na" i={i} prog={prog} />
          <Ion kind="Cl" i={i} prog={prog} />
        </group>
      ))}
      {PAIRS.map((_, i) => <Transfer key={i} i={i} prog={prog} />)}
      <Bonds prog={prog} />
      <OrbitControls enablePan={false} minDistance={6} maxDistance={24} />
    </>
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

const FIRST = Math.min(...PAIRS.map((p) => p.tm));
const LAST = Math.max(...PAIRS.map((p) => p.arrive));

/** شبیه‌سازی سه‌بعدی واکنش سدیم و کلر: برخوردهای جداگانه، انتقال الکترون و ساخته‌شدن چند خوشه‌ی بلوری. */
export default function NaClReaction() {
  const prog = useRef(0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ever, setEver] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [webgl] = useState(hasWebGL);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setEver(true);
    }, { rootMargin: "100px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (playing && t >= 1) setPlaying(false);
  }, [playing, t]);

  const time = t * DURATION;
  const ions = PAIRS.filter((p) => time >= p.tc).length;
  const transferring = PAIRS.some((p) => time >= p.tm + 0.2 && time < p.tm + 1.2);
  const neutral = N_ATOMS - ions;
  const finished = t >= 1;

  const stage =
    time < FIRST - 0.4
      ? { title: "۱. اتم‌های خنثی در حرکت‌اند", text: "اتم‌های سدیم (Na) و کلر (Cl) آزادانه حرکت می‌کنند. همه خنثی‌اند: تعداد پروتون‌ها با تعداد الکترون‌ها برابر است. Na در مدار آخر ۱ الکترون و Cl ۷ الکترون دارد." }
      : time < LAST
        ? transferring
          ? { title: "۲. برخورد و انتقال الکترون", text: "وقتی Na به Cl می‌رسد، الکترون مدار آخر Na (نقطه صورتی) به Cl می‌پرد. Na با یک الکترون کمتر به یون Na⁺ و Cl با یک الکترون بیشتر به یون Cl⁻ تبدیل می‌شود؛ هم‌زمان کمی انرژی (جرقه) آزاد می‌شود." }
          : { title: "۳. یون‌ها یکدیگر را می‌ربایند", text: "Na⁺ و Cl⁻ بارهای ناهمنام دارند و همدیگر را جذب می‌کنند، پس به سمت هم می‌روند و کنار هم می‌نشینند. واکنش‌ها در جاها و زمان‌های مختلف رخ می‌دهد و اتم‌هایی که جفت نشده‌اند هنوز خنثی‌اند." }
        : { title: "۴. بلور نمک", text: "یون‌های ناهمنام در چند جا کنار هم نشسته‌اند و خوشه‌های بلوری ساخته‌اند؛ هر Na⁺ را چند Cl⁻ احاطه کرده است. بلور واقعی نمک خوراکی همین الگو را میلیاردها بار تکرار می‌کند. اتم‌های بی‌جفت همچنان خنثی‌اند." };

  const seek = (v: number) => {
    prog.current = v;
    setT(v);
    setPlaying(false);
  };
  const toggle = () => {
    if (finished) {
      prog.current = 0;
      setT(0);
      setPlaying(true);
    } else setPlaying((p) => !p);
  };

  const card = (label: string, name: string, p: number, e: number, charge: string, count: number, tone: "neutral" | "pos" | "neg") => {
    const on = tone !== "neutral" && count > 0;
    return (
      <div className={`rounded-xl border p-2.5 text-xs transition ${on ? (tone === "pos" ? "border-sky-400/70 bg-sky-400/10" : "border-red-400/70 bg-red-400/10") : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"}`}>
        <p className="mb-1 flex items-center justify-between font-bold">
          <span className="text-base" dir="ltr">{label}</span>
          <span className="text-[11px]">{name}</span>
        </p>
        <p className="mb-1 text-[11px] text-slate-500 dark:text-slate-400">الان: <b className="text-slate-800 dark:text-slate-100">{toFa(count)}</b> عدد</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-2">
          <dt className="text-red-600 dark:text-red-400">پروتون</dt><dd className="font-semibold">{toFa(p)}</dd>
          <dt className="text-sky-600 dark:text-sky-400">الکترون</dt><dd className="font-semibold">{toFa(e)}</dd>
          <dt>بار</dt><dd className="font-semibold">{charge}</dd>
        </dl>
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <div ref={boxRef} className="relative h-[26rem] overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 to-[#0b1a33] md:h-[32rem]">
        {!webgl && (
          <p role="alert" className="grid h-full place-items-center p-4 text-center text-sm text-white">
            مرورگر شما از گرافیک سه‌بعدی (WebGL) پشتیبانی نمی‌کند.
          </p>
        )}
        {webgl && ever && (
          <Canvas dpr={[1, 2]} frameloop={visible ? "always" : "never"} camera={{ position: [0, 2.5, 16], fov: 45 }} aria-label="شبیه‌سازی سه‌بعدی واکنش سدیم و کلر">
            <Scene prog={prog} playing={playing} onTick={setT} />
          </Canvas>
        )}
        <p className="pointer-events-none absolute end-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[11px] text-white">بکشید تا بچرخد</p>
        <div className="pointer-events-none absolute start-2 top-2 flex flex-col gap-1 text-[11px] text-white">
          <span className="inline-flex items-center gap-1.5 rounded bg-black/45 px-2 py-0.5"><span className="size-2.5 rounded-full bg-orange-400" />هسته‌ی سدیم (Na)</span>
          <span className="inline-flex items-center gap-1.5 rounded bg-black/45 px-2 py-0.5"><span className="size-2.5 rounded-full bg-yellow-300" />هسته‌ی کلر (Cl)</span>
          <span className="inline-flex items-center gap-1.5 rounded bg-black/45 px-2 py-0.5"><span className="size-2.5 rounded-full bg-sky-400" />الکترون</span>
          <span className="inline-flex items-center gap-1.5 rounded bg-black/45 px-2 py-0.5"><span className="size-2.5 rounded-full bg-pink-400" />الکترون منتقل‌شونده</span>
          <span className="inline-flex items-center gap-1.5 rounded bg-black/45 px-2 py-0.5"><span className="size-2.5 rounded-full bg-sky-400/40 ring-1 ring-sky-300" />هاله‌ی آبی: یون مثبت</span>
          <span className="inline-flex items-center gap-1.5 rounded bg-black/45 px-2 py-0.5"><span className="size-2.5 rounded-full bg-red-400/40 ring-1 ring-red-300" />هاله‌ی قرمز: یون منفی</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white">
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          {playing ? "توقف" : finished ? "تکرار واکنش" : t > 0 ? "ادامه" : "شروع واکنش"}
        </button>
        <button onClick={() => seek(0)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800">
          <RotateCcw className="size-4" aria-hidden="true" /> از اول
        </button>
        <input type="range" min="0" max="1" step="0.002" value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="پیشرفت واکنش" className="min-w-[8rem] flex-1 accent-teal-600" />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {card("Na", "اتم سدیم", 11, 11, "۰ (خنثی)", N_ATOMS - ions, "neutral")}
        {card("Na⁺", "یون سدیم", 11, 10, "+۱", ions, "pos")}
        {card("Cl", "اتم کلر", 17, 17, "۰ (خنثی)", N_ATOMS - ions, "neutral")}
        {card("Cl⁻", "یون کلرید", 17, 18, "−۱", ions, "neg")}
      </div>
      <div className="rounded-xl bg-white p-3 text-sm leading-7 dark:bg-slate-800" aria-live="polite">
        <p className="mb-1 font-bold text-brand-700 dark:text-brand-500">{stage.title}</p>
        <p>{stage.text}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">اتم‌های خنثی‌ی باقی‌مانده از هر نوع: {toFa(neutral)}</p>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        برای سادگی، اتم‌های کلر جدا از هم نشان داده شده‌اند (در واقعیت گاز کلر از مولکول Cl₂ ساخته شده است) و تعداد ذره‌ها کم است؛ بلور واقعی نمک شامل میلیاردها یون است. اندازه‌ها و سرعت‌ها واقعی نیستند.
      </p>
    </div>
  );
}
