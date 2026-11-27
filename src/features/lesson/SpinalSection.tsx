import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Bone, Route, Tag } from "lucide-react";
import { LazyCanvas } from "./LazyCanvas";
import { loft, buildStem } from "./body/brainGeo";

type K = "white" | "gray" | "canal";
type Level = "cervical" | "thoracic" | "lumbar";
type V3 = [number, number, number];

const INFO: Record<K, { title: string; text: string }> = {
  white: { title: "بخش سفید", text: "بخش بیرونی نخاع که رنگ روشن‌تری دارد." },
  gray: { title: "بخش خاکستری", text: "بخش درونی نخاع که شکلی شبیه پروانه (حرف H) دارد و رنگ آن تیره‌تر است." },
  canal: { title: "مجرای وسط نخاع", text: "کانالی باریک در مرکز نخاع." },
};

/* برش در سه ناحیه: شکل پروانه و اندازه‌ی بخش‌ها کمی فرق می‌کند */
const LEVELS: Record<Level, { label: string; a: number; b: number; dors: number; vent: number; lat: number; s: number }> = {
  cervical: { label: "ناحیه‌ی گردن", a: 1.0, b: 0.72, dors: 1.0, vent: 1.1, lat: 0, s: 0.14 },
  thoracic: { label: "ناحیه‌ی سینه", a: 0.78, b: 0.74, dors: 0.82, vent: 0.55, lat: 1, s: 0.42 },
  lumbar: { label: "ناحیه‌ی کمر", a: 0.92, b: 0.8, dors: 0.9, vent: 1.2, lat: 0, s: 0.74 },
};

const CORD_PTS: [number, number][] = [[0, 0.3], [0.02, -0.4], [-0.02, -1.3], [0.02, -2.1], [0, -2.9]];
const CORD_CURVE = new THREE.CatmullRomCurve3(CORD_PTS.map(([x, y]) => new THREE.Vector3(x, y, 0)));
const CORD_X = -2.05, CORD_Y = 0, SC = 1.08;
const SEC: V3 = [1.55, -1.35, 0.3];
const YELLOW = "#ecd072";

const bell = (s: number, m: number, w: number) => Math.exp(-(((s - m) / w) ** 2));

/* ---------- هندسه‌ها ---------- */
const cordR = (s: number) => 0.074 + 0.018 * bell(s, 0.16, 0.12) + 0.022 * bell(s, 0.76, 0.12) - 0.058 * Math.max(0, (s - 0.9) / 0.1) ** 1.5;
function cordGeo() {
  return loft(CORD_PTS, (s) => { const r = cordR(s); return [r, r * 0.84]; }, 160, 40);
}
/** رگ‌های سطحی نخاع: سرخرگ جلویی (قرمز) و سیاهرگ‌های پشتی (آبی) */
function vesselGeo(phi: number, wob: number, r: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 70; i++) {
    const s = 0.02 + 0.93 * (i / 70);
    const c = CORD_CURVE.getPointAt(s);
    const a = phi + 0.12 * Math.sin(i * wob);
    const R = cordR(s) + 0.003;
    pts.push(new THREE.Vector3(c.x + Math.cos(a) * R, c.y, Math.sin(a) * R * 0.84));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, r, 5, false);
}
function brainBase() {
  return { stem: buildStem() };
}

/** ۳۱ جفت عصب نخاعی: ریشه‌چه‌های پشتی و شکمی که به هم می‌پیوندند و رو به پایین و بیرون آویزان می‌شوند؛ در پایین دم اسب */
function buildNerves() {
  const thick: THREE.BufferGeometry[] = [], fine: THREE.BufferGeometry[] = [], gang: THREE.BufferGeometry[] = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const tube = (pts: THREE.Vector3[], r: number, n = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, 6, false);
  for (let i = 0; i < 31; i++) {
    const t = i / 30;
    const s = 0.04 + 0.9 * t;
    const c = CORD_CURVE.getPointAt(s);
    const R = cordR(s);
    const cauda = Math.max(0, (t - 0.72) / 0.28);
    for (const sd of [-1, 1]) {
      const mx = c.x + sd * (R + 0.07 - 0.03 * cauda), my = c.y - 0.1 - 0.12 * t - 0.45 * cauda * cauda;
      // ریشه‌چه‌ها
      for (const zs of [-1, 1]) {
        for (let j = 0; j < 3; j++) {
          const y0 = c.y + (j - 1) * 0.03 * (1 + t);
          fine.push(tube([V(c.x + sd * R * 0.9, y0, zs * R * 0.5), V(c.x + sd * (R + 0.02), y0 - 0.03, zs * 0.03), V(mx - sd * 0.02, my + 0.03, zs * 0.012), V(mx, my, 0)], 0.0038, 10));
        }
      }
      const gp = V(mx - sd * 0.035, my + 0.04, -0.03); const g = new THREE.SphereGeometry(0.014, 10, 8); g.scale(1, 1.7, 1); g.translate(gp.x, gp.y, gp.z); gang.push(g);
      // تنه‌ی عصب: رو به بیرون و پایین (تندتر در پایین)
      const ang = 0.72 + 0.62 * Math.pow(t, 1.1) + 0.12 * cauda;
      const L = 0.42 + 0.3 * t + 0.8 * cauda;
      const dx = sd * Math.cos(ang), dy = -Math.sin(ang);
      const q = (k: number, sag = 0) => V(mx + dx * L * k, my + dy * L * k - sag * k * k, 0.01 * k);
      thick.push(tube([q(0), q(0.3, 0.02), q(0.62, 0.05), q(1, 0.1)], 0.011 - 0.003 * t, 20));
      // انشعاب‌های ریز در انتها
      for (const f of [-1, 1]) {
        const a2 = ang + f * 0.28;
        const ex = sd * Math.cos(a2), ey = -Math.sin(a2);
        fine.push(tube([q(0.58, 0.04), V(mx + dx * L * 0.62 + ex * L * 0.18, my + dy * L * 0.62 + ey * L * 0.18 - 0.05, 0.01), V(mx + dx * L * 0.62 + ex * L * 0.42, my + dy * L * 0.62 + ey * L * 0.42 - 0.12, 0.015)], 0.0048, 10));
      }
    }
  }
  return { thick: mergeGeometries(thick)!, fine: mergeGeometries(fine)!, gang: mergeGeometries(gang)! };
}

/** بافت رشته‌ای برای بخش سفید */
function fibreTex() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * Math.PI;
    const v = 70 + Math.random() * 120;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`; g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.4, 1.4); return t;
}

/** برش عرضی: بخش سفید و پروانه‌ی خاکستری */
function sectionGeo(L: (typeof LEVELS)[Level]) {
  const n = 2.5;
  const top: THREE.Vector2[] = [], bot: THREE.Vector2[] = [];
  const N = 70;
  for (let i = 0; i <= N; i++) {
    const x = -1 + (2 * i) / N;
    const e = Math.pow(1 - Math.pow(Math.abs(x), n), 1 / n);
    const notch = 0.07 * Math.exp(-Math.pow(x / 0.045, 2)); // شیار پشتی
    const fiss = 0.3 * Math.exp(-Math.pow(x / 0.05, 2)); // شکاف جلویی
    top.push(new THREE.Vector2(x * L.a, (e - notch) * L.b));
    bot.push(new THREE.Vector2(x * L.a, (-e + fiss) * L.b));
  }
  const outline = [...top, ...bot.reverse()];
  const white = new THREE.Shape(outline);

  const dv = L.dors, vv = L.vent;
  const R: [number, number][] = [
    [0, 0.17], [0.12, 0.25], [0.24, 0.25 + 0.3 * dv], [0.33, 0.25 + 0.5 * dv], [0.41, 0.22 + 0.5 * dv], [0.42, 0.25 + 0.22 * dv],
    [0.5, 0.2], ...(L.lat ? ([[0.62, 0.17]] as [number, number][]) : []),
    [0.46 + 0.26 * vv, 0.13], [0.5 + 0.28 * vv, -0.08], [0.44 + 0.22 * vv, -0.14 - 0.2 * vv], [0.34 + 0.1 * vv, -0.2 - 0.22 * vv], [0.24, -0.26], [0.13, -0.2], [0, -0.16],
  ];
  const half = R.map(([x, y]) => new THREE.Vector3(x * L.a, y * L.b, 0));
  const left = half.slice(1, -1).reverse().map((p) => new THREE.Vector3(-p.x, p.y, 0));
  const ctrl = [...half, ...left];
  const gp = new THREE.CatmullRomCurve3(ctrl, true, "centripetal").getPoints(160).map((p) => new THREE.Vector2(p.x, p.y));
  const gray = new THREE.Shape(gp);
  const D = 0.55;
  const w = new THREE.ExtrudeGeometry(white, { depth: D, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.014, bevelSegments: 4, curveSegments: 6 });
  const g = new THREE.ExtrudeGeometry(gray, { depth: D + 0.035, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.01, bevelSegments: 4, curveSegments: 6 });
  return { w, g, D };
}

/** مسیر پیام در برش: ریشه‌ی پشتی (حسی) ← شاخ پشتی ← شاخ شکمی ← ریشه‌ی شکمی (حرکتی) */
function msgPaths(L: (typeof LEVELS)[Level], z: number) {
  const P = (x: number, y: number) => new THREE.Vector3(x * L.a, y * L.b, z);
  const sens = new THREE.CatmullRomCurve3([P(0.72, 1.28), P(0.55, 1.08), P(0.42, 0.25 + 0.4 * L.dors), P(0.36, 0.3), P(0.28, 0.12)]);
  const motor = new THREE.CatmullRomCurve3([P(0.28, 0.12), P(0.42, -0.02), P(0.5 + 0.26 * L.vent, -0.1), P(0.9, -0.26), P(1.16, -0.52)]);
  return { sens, motor, all: new THREE.CatmullRomCurve3([...sens.points, ...motor.points.slice(1)]) };
}

/* ---------- صحنه ---------- */
interface SceneProps {
  level: Level; sel: K | null; hover: K | null; vert: boolean; msg: boolean;
  setSel: (k: K | null) => void; setHover: (k: K | null) => void; bridge: React.MutableRefObject<Bridge>; names: boolean;
}
interface Bridge { els: (HTMLElement | null)[]; lines: (SVGLineElement | null)[] }
interface Lbl { text: string; color: string; off: [number, number]; at: (L: (typeof LEVELS)[Level]) => V3; k?: K }

const secPt = (L: (typeof LEVELS)[Level], x: number, y: number, z = 0.25): V3 => [SEC[0] + x * L.a * SC, SEC[1] + y * L.b * SC, SEC[2] + z];
const LABELS: Lbl[] = [
  { text: "بصل‌النخاع", color: "#f0abfc", off: [0.14, -0.04], at: () => [CORD_X, 0.62, 0] },
  { text: "نخاع", color: "#e2e8f0", off: [0.18, 0], at: () => [CORD_X, -0.95, 0.05] },
  { text: "اعصاب نخاعی (۳۱ جفت)", color: YELLOW, off: [-0.02, 0.17], at: () => [CORD_X - 0.3, -1.75, 0.03] },
  { text: "بخش سفید", color: "#fdf3dc", off: [0.2, -0.25], k: "white", at: (L) => secPt(L, 0.8, 0.52) },
  { text: "بخش خاکستری", color: "#e8c49a", off: [0.21, 0.08], k: "gray", at: (L) => secPt(L, 0.66, -0.06) },
  { text: "مجرای وسط نخاع", color: "#9bd2ff", off: [0.1, 0.38], k: "canal", at: (L) => secPt(L, 0, 0) },
];

const tmpV = new THREE.Vector3();

function Rig() {
  const camera = useThree((s) => s.camera);
  useEffect(() => { camera.position.set(-0.1, -1.1, 9.4); camera.lookAt(-0.2, -1.5, 0); }, [camera]);
  return <OrbitControls makeDefault enablePan={false} target={[-0.2, -1.5, 0]} minDistance={4} maxDistance={14} maxPolarAngle={Math.PI * 0.8} minPolarAngle={Math.PI * 0.2} />;
}

const Scene = memo(function Scene({ level, sel, hover, vert, msg, setSel, setHover, bridge, names }: SceneProps) {
  const L = LEVELS[level];
  const cord = useMemo(cordGeo, []);
  const base = useMemo(brainBase, []);
  const vA = useMemo(() => vesselGeo(Math.PI / 2, 0.7, 0.0042), []);
  const vB = useMemo(() => vesselGeo(-0.5, 0.55, 0.0032), []);
  const vC = useMemo(() => vesselGeo(Math.PI + 0.5, 0.6, 0.0032), []);
  const tex = useMemo(fibreTex, []);
  const nerves = useMemo(buildNerves, []);
  const sec = useMemo(() => sectionGeo(L), [L]);
  const mp = useMemo(() => msgPaths(L, sec.D + 0.075), [L, sec.D]);
  const sensTube = useMemo(() => new THREE.TubeGeometry(mp.sens, 40, 0.026, 8, false), [mp]);
  const motorTube = useMemo(() => new THREE.TubeGeometry(mp.motor, 40, 0.026, 8, false), [mp]);
  const bead = useRef<THREE.Group>(null);
  const beadMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringY = CORD_CURVE.getPointAt(L.s).y;

  // ستون مهره‌ها
  const vertebrae = useMemo(() => Array.from({ length: 24 }, (_, k) => {
    const y = 0.12 - k * 0.165;
    const sz = k < 7 ? 0.8 : k < 19 ? 1 : 1.25;
    return { y, sz };
  }), []);

  const sc = (k: K, base: string, emi: string) => ({
    color: base, emissive: emi, emissiveIntensity: sel === k ? 0.5 : hover === k ? 0.28 : 0,
  });

  useFrame(({ camera, size, clock }) => {
    const { els, lines } = bridge.current;
    LABELS.forEach((l, i) => {
      const el = els[i], ln = lines[i];
      if (!el || !ln) return;
      tmpV.set(...l.at(L)).project(camera);
      const ax = ((tmpV.x + 1) / 2) * size.width, ay = ((1 - tmpV.y) / 2) * size.height;
      const lx = Math.min(size.width - 60, Math.max(60, ax + l.off[0] * size.width)), ly = Math.min(size.height - 16, Math.max(16, ay + l.off[1] * size.height));
      el.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -50%)`;
      ln.setAttribute("x1", String(lx)); ln.setAttribute("y1", String(ly)); ln.setAttribute("x2", String(ax)); ln.setAttribute("y2", String(ay));
    });
    if (bead.current) {
      const k = (clock.elapsedTime / 5) % 1;
      const p = mp.all.getPointAt(k);
      bead.current.position.copy(p);
      bead.current.visible = msg;
      beadMat.current?.color.set(k < 0.52 ? "#7dd3fc" : "#fdba74");
    }
  });
  void names;

  const pick = (k: K) => ({
    onClick: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setSel(sel === k ? null : k); },
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); setHover(k); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { setHover(null); document.body.style.cursor = ""; },
  });

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#3a4a6a", 0.7]} />
      <directionalLight position={[3, 4, 6]} intensity={2.4} />
      <directionalLight position={[-5, 1, -3]} intensity={0.9} color="#bcd2ff" />
      <Rig />

      {/* ----- نخاع و اعصاب ----- */}
      <group position={[CORD_X, CORD_Y, 0]}>
        <group position={[0.11, 1.07, 0]} scale={0.55}>
          <mesh geometry={base.stem}><meshStandardMaterial color="#d9b4ba" roughness={0.55} /></mesh>
        </group>
        <mesh geometry={cord}><meshStandardMaterial color="#f6ead0" roughness={0.38} metalness={0.02} /></mesh>
        <mesh geometry={vA}><meshStandardMaterial color="#c43c3c" roughness={0.4} /></mesh>
        <mesh geometry={vB}><meshStandardMaterial color="#4a6fb3" roughness={0.4} /></mesh>
        <mesh geometry={vC}><meshStandardMaterial color="#4a6fb3" roughness={0.4} /></mesh>
        <mesh geometry={nerves.thick}><meshStandardMaterial color={YELLOW} roughness={0.35} /></mesh>
        <mesh geometry={nerves.fine}><meshStandardMaterial color="#f3dd8c" roughness={0.4} /></mesh>
        <mesh geometry={nerves.gang}><meshStandardMaterial color="#c9a43a" roughness={0.5} /></mesh>
        {/* نشانه‌ی محل برش */}
        <mesh position={[0, ringY, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.11, 0.012, 10, 40]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {vert && (
          <group>
            {vertebrae.map((v, k) => (
              <group key={k} position={[0, v.y, 0]} scale={v.sz}>
                <mesh position={[0, 0, 0.17]}><cylinderGeometry args={[0.16, 0.16, 0.1, 20]} /><meshStandardMaterial color="#e9dfc6" roughness={0.6} transparent opacity={0.5} depthWrite={false} /></mesh>
                <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.0]}><torusGeometry args={[0.13, 0.03, 8, 20, Math.PI * 1.45]} /><meshStandardMaterial color="#e9dfc6" roughness={0.6} transparent opacity={0.5} depthWrite={false} /></mesh>
                <mesh position={[0, -0.03, -0.2]} rotation-x={-Math.PI / 2 - 0.35}><coneGeometry args={[0.03, 0.17, 8]} /><meshStandardMaterial color="#e9dfc6" roughness={0.6} transparent opacity={0.5} depthWrite={false} /></mesh>
              </group>
            ))}
          </group>
        )}
      </group>

      {/* خط ارتباط برش با نخاع */}
      <ConnectLine from={[CORD_X + 0.12, ringY, 0]} to={[SEC[0] - L.a * SC - 0.1, SEC[1] + 0.1, SEC[2] + 0.2]} />

      {/* ----- برش عرضی بزرگ‌نمایی‌شده ----- */}
      <group position={[SEC[0], SEC[1], 0]} scale={SC}>
        <mesh geometry={sec.w} {...pick("white")}>
          <meshStandardMaterial {...sc("white", "#f3e7cc", "#fde047")} roughness={0.5} bumpMap={tex} bumpScale={1.6} />
        </mesh>
        <mesh geometry={sec.g} {...pick("gray")}>
          <meshStandardMaterial {...sc("gray", "#dcab80", "#fde047")} roughness={0.55} bumpMap={tex} bumpScale={0.8} />
        </mesh>
        <mesh position={[0, 0, sec.D + 0.065]} rotation-x={Math.PI / 2} {...pick("canal")}>
          <cylinderGeometry args={[0.045, 0.045, 0.02, 20]} />
          <meshStandardMaterial {...sc("canal", "#ffffff", "#7dd3fc")} roughness={0.3} />
        </mesh>
        {msg && (
          <>
            <mesh geometry={sensTube}><meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.7} /></mesh>
            <mesh geometry={motorTube}><meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={0.7} /></mesh>
          </>
        )}
        <group ref={bead}>
          <mesh><sphereGeometry args={[0.065, 14, 10]} /><meshBasicMaterial ref={beadMat} color="#7dd3fc" /></mesh>
          <mesh><sphereGeometry args={[0.16, 14, 10]} /><meshBasicMaterial color="#fde047" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
        </group>
      </group>
    </>
  );
});

function ConnectLine({ from, to }: { from: V3; to: V3 }) {
  const geo = useMemo(() => {
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), new THREE.Vector3((from[0] + to[0]) / 2, from[1] + 0.05, 0.5), new THREE.Vector3(...to));
    return new THREE.TubeGeometry(c, 30, 0.012, 6, false);
  }, [from, to]);
  const dir = new THREE.Vector3(...to).sub(new THREE.Vector3((from[0] + to[0]) / 2, from[1] + 0.05, 0.5)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return (
    <group>
      <mesh geometry={geo}><meshBasicMaterial color="#9fb3cf" /></mesh>
      <mesh position={to} quaternion={q}><coneGeometry args={[0.05, 0.14, 12]} /><meshBasicMaterial color="#9fb3cf" /></mesh>
    </group>
  );
}

/** نخاع و برشی از آن (شکل ۷ کتاب) به‌صورت سه‌بعدی. */
export default function SpinalSection() {
  const [sel, setSel] = useState<K | null>(null);
  const [hover, setHover] = useState<K | null>(null);
  const [level, setLevel] = useState<Level>("cervical");
  const [names, setNames] = useState(true);
  const [vert, setVert] = useState(false);
  const [msg, setMsg] = useState(false);
  const bridge = useRef<Bridge>({ els: [], lines: [] });

  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${on ? "bg-amber-400 font-bold text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`;
  const overlay = (
    <div className="pointer-events-none absolute inset-0" style={{ direction: "ltr" }}>
      {names && (
        <>
          <svg className="absolute inset-0 size-full">
            {LABELS.map((l, i) => <line key={i} ref={(el) => { bridge.current.lines[i] = el; }} stroke={l.color} strokeOpacity="0.75" strokeWidth="1.2" />)}
          </svg>
          {LABELS.map((l, i) => (
            <span key={i} ref={(el) => { bridge.current.els[i] = el; }} className="absolute left-0 top-0 whitespace-nowrap rounded-full border bg-slate-950/80 px-2.5 py-0.5 text-xs font-bold text-white md:text-sm" style={{ borderColor: l.color, direction: "rtl" }}>
              {l.text}
            </span>
          ))}
        </>
      )}
      <span className="absolute bottom-2 left-3 text-[11px] text-slate-400" style={{ direction: "rtl" }}>بکشید تا بچرخد · روی هر بخش برش بزنید</span>
    </div>
  );

  return (
    <div className="space-y-3 rounded-2xl bg-slate-900 p-3 text-slate-100">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LEVELS) as Level[]).map((k) => <button key={k} className={chip(level === k)} onClick={() => setLevel(k)}>{LEVELS[k].label}</button>)}
        <span className="mx-1 hidden w-px bg-white/15 sm:block" />
        <button className={chip(names)} onClick={() => setNames((v) => !v)} aria-pressed={names}><Tag className="size-4" aria-hidden="true" /> نام اجزا</button>
        <button className={chip(vert)} onClick={() => setVert((v) => !v)} aria-pressed={vert}><Bone className="size-4" aria-hidden="true" /> ستون مهره‌ها</button>
        <button className={chip(msg)} onClick={() => setMsg((v) => !v)} aria-pressed={msg}><Route className="size-4" aria-hidden="true" /> مسیر پیام در برش</button>
      </div>
      <LazyCanvas camera={{ position: [-0.1, -1.1, 9.4], fov: 38 }} label="مدل سه‌بعدی نخاع و برش عرضی آن" overlay={overlay} className="h-[26rem] md:h-[34rem]">
        <Scene level={level} sel={sel} hover={hover} vert={vert} msg={msg} setSel={setSel} setHover={setHover} bridge={bridge} names={names} />
      </LazyCanvas>
      <div className="min-h-[3.5rem] rounded-xl bg-white/[0.05] p-3 text-sm leading-7" aria-live="polite">
        {sel ? (
          <><p className="font-bold text-amber-300">{INFO[sel].title}</p><p>{INFO[sel].text}</p></>
        ) : msg ? (
          <p className="text-slate-200"><span className="font-bold text-sky-300">پیام حسی</span> از راه ریشه‌ی پشتی وارد نخاع می‌شود و <span className="font-bold text-orange-300">پیام حرکتی</span> از راه ریشه‌ی شکمی از آن خارج می‌شود.</p>
        ) : (
          <p className="text-slate-300">نخاع طنابی سفیدرنگ است. حلقه‌ی آبی محل برش را نشان می‌دهد؛ ناحیه‌ی برش را عوض کنید و روی هر بخش برش بزنید.</p>
        )}
      </div>
    </div>
  );
}
