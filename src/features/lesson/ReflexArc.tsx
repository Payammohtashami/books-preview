import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Eye, Pause, Play, RotateCcw, Tag } from "lucide-react";
import { LazyCanvas } from "./LazyCanvas";
import { ARM_REST, buildHands, buildSeatedSkin, HAND_LEN, HEAD_O, HEAD_S, HP } from "./body/seatedSkin";
import { buildCerebellum, buildHemisphere, buildStem, loft } from "./body/brainGeo";

/* ───────── زمان‌بندی و متن مرحله‌ها ───────── */
const DURATION = { reflex: 14, voluntary: 22 };
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const ramp = (t: number, a: number, b: number) => smooth(clamp((t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type V3 = [number, number, number];
const SENSE = "#38bdf8";
const MOTOR = "#fb923c";
const GLOW = "#fde047";

const MODES = {
  reflex: {
    label: "غیرارادی: انعکاس زانو",
    stages: [
      { to: 0.14, title: "۱. ضربه به زیر زانو", text: "ضربه‌ی چکش، گیرنده‌های زانو را تحریک می‌کند." },
      { to: 0.44, title: "۲. پیام حسی به نخاع می‌رود", text: "عصب حسی پیام را به نخاع می‌رساند." },
      { to: 0.52, title: "۳. نخاع تصمیم می‌گیرد", text: "نخاع مرکز این انعکاس است؛ پیام حرکتی را بدون عبور از مغز و بدون اراده می‌سازد." },
      { to: 0.78, title: "۴. پیام حرکتی به ماهیچه می‌رود", text: "عصب حرکتی پیام را از نخاع به ماهیچه‌ی جلوی ران می‌برد." },
      { to: 1, title: "۵. پا بالا می‌آید", text: "ماهیچه منقبض می‌شود و ساق پا بدون اراده بالا می‌آید. (اطلاعات تکمیلی: هم‌زمان پیامی هم به مغز می‌رسد و بعد از آن متوجه ضربه می‌شویم.)" },
    ],
  },
  voluntary: {
    label: "ارادی: برداشتن مداد افتاده",
    stages: [
      { to: 0.1, title: "۱. صدای افتادن مداد", text: "مداد از روی میز می‌افتد و صدایش به گوش می‌رسد." },
      { to: 0.28, title: "۲. پیام حسی به مغز می‌رود", text: "گیرنده‌های گوش پیام را از راه عصب به مغز می‌فرستند." },
      { to: 0.4, title: "۳. مغز تصمیم می‌گیرد", text: "مغز پیام را دریافت و بررسی می‌کند و تصمیم می‌گیرد مداد را بردارد. چون با اراده و خواست ما انجام می‌شود، فعالیت ارادی است." },
      { to: 0.58, title: "۴. پیام حرکتی از مغز می‌آید", text: "مغز به ماهیچه‌های دست پیام می‌دهد؛ پیام از نخاع و عصب حرکتی می‌گذرد." },
      { to: 1, title: "۵. ماهیچه منقبض می‌شود", text: "ماهیچه‌های دست منقبض می‌شوند، دست خم می‌شود و مداد را برمی‌داریم. سپس صاف می‌نشینیم و مداد را روی میز می‌گذاریم." },
    ],
  },
};
type Mode = keyof typeof MODES;

/* ───────── هندسه‌ی بدن (محور x رو به جلوی بدن، y بالا) ───────── */
const PY = 0.52; // محور خم‌شدن تنه (لگن)
const HIP_T: V3 = [0, 0.52, 0.1];
const K_T: V3 = [0.42, 0.59, -0.06];
const HIP_B: V3 = [0, 0.5, -0.15];
const K_B: V3 = [0.42, 0.46, -0.17];
const A_B: V3 = [0.34, 0.07, -0.17];
const A0 = 0.12; // زاویه‌ی آویزان‌بودن ساق پای روی پا
const SHIN_LEN = 0.4;
const PENCIL_LAND: V3 = [0.3, 0.03, 0.46];
const PENCIL_REST: V3 = [0.5, 0.765, 0.5];
const DIR_T = new THREE.Vector3(K_T[0] - HIP_T[0], K_T[1] - HIP_T[1], K_T[2] - HIP_T[2]);
const along = (s: number, o: V3 = [0, 0, 0]): V3 => [HIP_T[0] + DIR_T.x * s + o[0], HIP_T[1] + DIR_T.y * s + o[1], HIP_T[2] + DIR_T.z * s + o[2]];
const U = (x: number, y: number, z: number): V3 => [x, y - PY, z]; // مختصات درون گروه تنه
const upath = (pts: V3[]): V3[] => pts.map((p) => U(...p));

/* ───────── مسیر عصب‌ها ───────── */
// انعکاس (دستگاه مختصات جهان؛ تنه صاف است)
const STRIKE: V3 = [0.484, 0.522, -0.06];
const SENS_R: V3[] = [STRIKE, along(0.93, [0, -0.018, 0.01]), along(0.6, [0, -0.02, 0.014]), along(0.28, [0, -0.02, 0.014]), [0.02, 0.55, 0.075], [-0.03, 0.6, 0.04], [-0.046, 0.66, 0.012]];
const MOTO_R: V3[] = [[-0.046, 0.69, 0.0], [-0.03, 0.62, 0.065], along(0.12, [0, 0.02, 0.03]), along(0.4, [0, 0.024, 0.03]), along(0.62, [0, 0.026, 0.02])];
const CORD: V3[] = [HP(-0.2, -1.4, 0), [-0.018, 1.2, 0], [-0.045, 1.07, 0], [-0.062, 0.94, 0], [-0.06, 0.8, 0], [-0.045, 0.67, 0], [-0.03, 0.6, 0]];
const CORD_UP: V3[] = [[-0.046, 0.69, 0.0], [-0.061, 0.85, 0], [-0.05, 1.05, 0], [-0.012, 1.22, 0], HP(-0.2, -1.2, 0), HP(0, 0, 0)];
// ارادی (درون گروه تنه)
const EAR_BRAIN: V3[] = upath([HP(-0.1, -0.4, 0.98), HP(0, -0.2, 0.6), HP(0.1, 0, 0.3)]);
const BRAIN_ARM: V3[] = upath([HP(0, 0, 0), HP(-0.2, -1.25, 0), [-0.018, 1.2, 0.0], [-0.04, 1.1, 0.0], [-0.02, 1.08, 0.12], [0.01, 1.09, 0.19], [0.03, 0.97, 0.215], [0.03, 0.9, 0.222]]);

/* ───────── ابزارهای رسم ───────── */
function Limb({ a, b, r1, r2, mat }: { a: V3; b: V3; r1: number; r2: number; mat: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
    return { pos: A.clone().add(B).multiplyScalar(0.5), len: d.length(), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={mat}>
      <cylinderGeometry args={[r2, r1, len, 20]} />
    </mesh>
  );
}
const Ball = ({ p, r, mat, s = [1, 1, 1] }: { p: V3; r: number; mat: THREE.Material; s?: V3 }) => (
  <mesh position={p} scale={s} material={mat}><sphereGeometry args={[r, 24, 16]} /></mesh>
);

/** عصب: لوله‌ی کم‌رنگ + بخش روشن‌شونده تا نقطه‌ی پیشرفت + گوی نورانی */
function Nerve({ pts, color, get, fade, r = 0.0075, glowR = 0.034 }: { pts: V3[]; color: string; get: () => number; fade?: () => number; r?: number; glowR?: number }) {
  const SEG = 64, RAD = 6;
  const curve = useMemo(() => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.4), [pts]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, SEG, r, RAD, false), [curve, r]);
  const litGeo = useMemo(() => new THREE.TubeGeometry(curve, SEG, r * 1.3, RAD, false), [curve, r]);
  const lit = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const litMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const k = clamp(get());
    if (litMat.current && fade) litMat.current.opacity = clamp(fade());
    const m = lit.current, h = head.current;
    if (!m || !h) return;
    m.visible = k > 0;
    litGeo.setDrawRange(0, Math.max(0, Math.floor(k * SEG)) * RAD * 6);
    const on = k > 0 && k < 1;
    h.visible = on;
    if (on) h.position.copy(curve.getPointAt(k));
  });
  return (
    <group>
      <mesh geometry={geo}><meshStandardMaterial color={color} transparent opacity={0.42} roughness={0.5} /></mesh>
      <mesh ref={lit} geometry={litGeo}><meshStandardMaterial ref={litMat} color={color} emissive={color} emissiveIntensity={1.1} roughness={0.4} transparent /></mesh>
      <group ref={head}>
        <mesh><sphereGeometry args={[r * 2.4, 16, 12]} /><meshBasicMaterial color="#fffbd0" /></mesh>
        <mesh><sphereGeometry args={[glowR, 16, 12]} /><meshBasicMaterial color={GLOW} transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
      </group>
    </group>
  );
}

/** برچسب نوشتاری سه‌بعدی (اسپرایت) با خط راهنما */
function Label({ text, at, to, color = "#e2e8f0", show }: { text: string; at: V3; to: V3; color?: string; show: boolean }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 420; c.height = 104;
    const g = c.getContext("2d")!;
    g.font = '700 44px Vazirmatn, "Segoe UI", system-ui, sans-serif';
    g.direction = "rtl"; g.textAlign = "center"; g.textBaseline = "middle";
    const w = Math.min(c.width - 8, g.measureText(text).width + 56);
    g.fillStyle = "rgba(15,23,42,0.86)"; g.strokeStyle = color; g.lineWidth = 5;
    g.beginPath(); g.roundRect((c.width - w) / 2, 8, w, c.height - 16, 30); g.fill(); g.stroke();
    g.fillStyle = "#f8fafc"; g.fillText(text, c.width / 2, c.height / 2 + 3);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color]);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...at), new THREE.Vector3(...to)]);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthTest: false }));
  }, [at, to, color]);
  return (
    <group visible={show}>
      <primitive object={line} renderOrder={19} />
      <sprite position={at} scale={[0.33, 0.081, 1]} renderOrder={20}><spriteMaterial map={tex} depthTest={false} transparent /></sprite>
    </group>
  );
}

/** سایه‌ی نرم زیر بدن */
function blobTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ───────── صحنه ───────── */
interface SceneProps { mode: Mode; tRef: MutableRefObject<number>; xray: boolean; names: boolean }

const Scene = memo(function Scene({ mode, tRef, xray, names }: SceneProps) {
  const reflex = mode === "reflex";
  const m = useMemo(() => {
    const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
    return {
      skin: std("#e6a58f", { transparent: true, opacity: 1, emissive: "#ff8fb0", emissiveIntensity: 0, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc, stencilZPass: THREE.ReplaceStencilOp }),
      muscle: std("#c2362f", { roughness: 0.45, emissive: "#ff2a1c", emissiveIntensity: 0 }),
      tendon: std("#f1e6cf", { roughness: 0.4 }),
      receptor: std("#38bdf8", { emissive: "#38bdf8", emissiveIntensity: 0.6 }),
      brain: std("#d7a3a6", { roughness: 0.5, emissive: "#ffd84d", emissiveIntensity: 0 }),
      cereb: std("#c4909a", { roughness: 0.55, emissive: "#ffd84d", emissiveIntensity: 0 }),
      stem: std("#e3b7ae", { roughness: 0.5, emissive: "#ffd84d", emissiveIntensity: 0 }),
      root: std("#e8c64a", { roughness: 0.5 }),
      bone: std("#e9dfc6", { roughness: 0.6, transparent: true, opacity: 0.55 }),
      cord: std("#f1e6c8", { roughness: 0.45, emissive: "#ffd84d", emissiveIntensity: 0 }),
      shoe: std("#1f2937", { roughness: 0.7 }),
      chair: std("#475569", { roughness: 0.55, metalness: 0.2 }),
      wood: std("#8d6e4c", { roughness: 0.6 }),
      hammer: std("#cbd5e1", { roughness: 0.35, metalness: 0.4 }),
      rubber: std("#dc2626", { roughness: 0.5 }),
      pencil: std("#facc15", { roughness: 0.5 }),
    };
  }, []);
  useEffect(() => {
    m.skin.opacity = xray ? 0.42 : 1;
    m.skin.depthWrite = !xray;
    m.skin.color.set(xray ? "#f2a3b6" : "#e6a58f");
    m.skin.emissiveIntensity = xray ? 0.18 : 0;
    m.skin.stencilWrite = xray; // هر پیکسل فقط یک‌بار رنگ می‌شود: بدن یک‌تکه دیده می‌شود
    m.skin.needsUpdate = true;
  }, [xray, m]);

  // پوست یک‌تکه‌ی بدن (اسکین‌شده روی لگن، تنه، بازوی راست [بالا/ساعد] و ساق پای رویی)
  const body = useMemo(() => {
    const geo = buildSeatedSkin({ hipT: HIP_T, kneeT: K_T, hipB: HIP_B, kneeB: K_B, ankleB: A_B, pivotY: PY, shinLen: SHIN_LEN, shinA0: A0 });
    const bones = [0, 1, 2, 3, 4].map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = false; return b; });
    const R = ARM_REST.R;
    const rest = [
      new THREE.Matrix4(),
      new THREE.Matrix4().makeTranslation(0, PY, 0),
      new THREE.Matrix4().makeTranslation(...R.sh),
      new THREE.Matrix4().makeTranslation(...R.el),
      new THREE.Matrix4().makeTranslation(...K_T).multiply(new THREE.Matrix4().makeRotationZ(A0)),
    ];
    bones.forEach((b, i) => { b.matrix.copy(rest[i]); b.matrixWorld.copy(rest[i]); });
    const mesh = new THREE.SkinnedMesh(geo, m.skin);
    mesh.frustumCulled = false;
    mesh.add(...bones);
    const inv = rest.map((r) => r.clone().invert());
    const skel = new THREE.Skeleton(bones, inv);
    mesh.bind(skel, new THREE.Matrix4());
    const hands = new THREE.SkinnedMesh(buildHands(), m.skin);
    hands.frustumCulled = false;
    hands.bind(skel, new THREE.Matrix4());
    return { mesh, hands, bones, inv, rest };
  }, [m]);

  // مغز، مخچه، ساقه‌ی مغز و نخاع واقع‌نما
  const anat = useMemo(() => {
    const hemR = buildHemisphere(1, 36).geometry, hemL = buildHemisphere(-1, 36).geometry;
    const cereb = buildCerebellum(30), stem = buildStem();
    const pts: [number, number][] = CORD.map((p) => [p[0], p[1] - CORD[0][1]]);
    const bell = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
    const cord = loft(pts, (sx) => {
      const r = 0.0105 + 0.0028 * bell(sx, 0.2, 0.14) + 0.0035 * bell(sx, 0.78, 0.12) - 0.008 * Math.max(0, (sx - 0.88) / 0.12) ** 1.5;
      return [r, r * 0.86];
    }, 90, 20);
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const list: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 31; i++) {
      const sp = 0.04 + 0.94 * (i / 30);
      const c = curve.getPointAt(sp);
      const d = Math.pow(i / 30, 2.2);
      for (const sd of [-1, 1]) {
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(c.x, c.y, sd * 0.008), new THREE.Vector3(c.x - 0.002, c.y - 0.004 - 0.015 * d, sd * 0.02),
          new THREE.Vector3(c.x - 0.002, c.y - 0.01 - 0.035 * d, sd * 0.03), new THREE.Vector3(c.x + 0.002, c.y - 0.022 - 0.05 * d, sd * 0.04),
        ]), 8, 0.0016, 5, false);
        list.push(tube);
      }
    }
    return { hemR, hemL, cereb, stem, cord, roots: mergeGeometries(list)! };
  }, []);
  const blob = useMemo(blobTexture, []);
  const T = () => tRef.current;

  // مراجع اجسام متحرک
  const hammer = useRef<THREE.Group>(null);
  const shin = useRef<THREE.Group>(null);
  const quad = useRef<THREE.Mesh>(null);
  const recept = useRef<THREE.Mesh>(null);
  const upper = useRef<THREE.Group>(null);
  const bicepsG = useRef<THREE.Group>(null);
  const armCtl = useRef({ reach: 0, tk: 0, lean: 0 });
  const handPose = useRef({ w: new THREE.Vector3(), f: new THREE.Vector3(1, 0, 0) });
  const biceps = useRef<THREE.Mesh>(null);
  const pencil = useRef<THREE.Group>(null);
  const brainM = useRef<THREE.Group>(null);
  const cordGlow = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);

  const tmp = useMemo(() => ({
    q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), d: new THREE.Vector3(),
    down: new THREE.Vector3(0, -1, 0), pivot: new THREE.Vector3(0, PY, 0), land: new THREE.Vector3(...PENCIL_LAND), rest: new THREE.Vector3(...PENCIL_REST), tg: new THREE.Vector3(), qi: new THREE.Quaternion(), ax: new THREE.Vector3(1, 0, 0), az: new THREE.Vector3(0, 0, 1),
    quadAxis: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), DIR_T.clone().normalize()),
  }), []);

  useFrame(() => {
    { const t = tRef.current; const w = reflex ? [0.42, 0.56] : [0.4, 0.6]; const b = Math.sin(Math.PI * clamp((t - w[0]) / (w[1] - w[0]))); m.cord.emissiveIntensity = 0.45 + 1.5 * b; }
    const t = T();
    // ---- انعکاس ----
    if (reflex) {
      const ang = t < 0.13 ? lerp(2.55, 3.653, Math.pow(clamp(t / 0.13), 2.2)) : lerp(3.653, 2.55, ramp(t, 0.15, 0.27));
      if (hammer.current) hammer.current.rotation.z = ang;
      const c = ramp(t, 0.72, 0.8) * (1 - ramp(t, 0.93, 1.0));
      const kick = ramp(t, 0.78, 0.88) * (1 - ramp(t, 0.9, 0.99)) * 0.72 + Math.sin(clamp((t - 0.88) / 0.06) * Math.PI) * 0.04;
      if (shin.current) shin.current.rotation.z = A0 + kick;
      if (quad.current) {
        quad.current.scale.set(0.3 * (1 - 0.2 * c), 0.03 * (1 + 0.3 * c), 0.038 * (1 + 0.3 * c));
        m.muscle.emissiveIntensity = 0.9 * c;
      }
      const flash = Math.sin(Math.PI * clamp((t - 0.12) / 0.14));
      m.receptor.emissiveIntensity = 0.6 + 3 * flash;
      if (recept.current) recept.current.scale.setScalar(1 + 0.9 * flash);
      const cg = Math.sin(Math.PI * clamp((t - 0.42) / 0.14));
      if (cordGlow.current) { cordGlow.current.visible = cg > 0.01; cordGlow.current.scale.setScalar(0.45 + cg * 0.55); (cordGlow.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * cg; }
      const bf = Math.sin(Math.PI * clamp((t - 0.86) / 0.14)) * 0.5;
      m.brain.emissiveIntensity = bf; m.cereb.emissiveIntensity = bf; m.stem.emissiveIntensity = bf;
    } else {
      // ---- ارادی: افتادن مداد، برداشتن، راست‌شدن و گذاشتن روی میز ----
      const lean = ramp(t, 0.56, 0.68) * (1 - ramp(t, 0.7, 0.82)) * 0.5;
      const reach = ramp(t, 0.58, 0.68) * (1 - ramp(t, 0.9, 0.97));
      const tk = ramp(t, 0.7, 0.84);
      armCtl.current.reach = reach; armCtl.current.tk = tk; armCtl.current.lean = lean;
      if (upper.current) upper.current.rotation.x = lean;
      if (pencil.current) {
        const pc = pencil.current;
        if (t < 0.09) {
          const roll = clamp(t / 0.03), fall = clamp((t - 0.03) / 0.06);
          pc.position.set(lerp(PENCIL_REST[0], PENCIL_LAND[0], fall), fall <= 0 ? PENCIL_REST[1] : lerp(PENCIL_REST[1], PENCIL_LAND[1], fall * fall), lerp(PENCIL_REST[2], 0.6, roll) + lerp(0, PENCIL_LAND[2] - 0.6, fall));
          pc.rotation.set(fall * 5.0, 0, Math.PI / 2 + fall * 1.4);
        } else if (t < 0.69) {
          pc.position.set(...PENCIL_LAND);
          pc.rotation.set(5.0, 0, Math.PI / 2 + 1.4);
        } else if (t < 0.88) {
          pc.position.copy(handPose.current.w).addScaledVector(handPose.current.f, 0.08);
          pc.rotation.set(0, 0, Math.PI / 2);
        } else {
          pc.position.set(...PENCIL_REST);
          pc.rotation.set(0, 0, Math.PI / 2);
        }
      }
      const c = ramp(t, 0.54, 0.6) * (1 - ramp(t, 0.88, 0.96));
      if (biceps.current) { biceps.current.scale.set(0.02 * (1 + 0.4 * c), 0.1 * (1 - 0.2 * c), 0.024 * (1 + 0.4 * c)); m.muscle.emissiveIntensity = 0.9 * c; }
      const bf = Math.sin(Math.PI * clamp((t - 0.28) / 0.2));
      m.brain.emissiveIntensity = bf * 0.9; m.cereb.emissiveIntensity = bf * 0.6; m.stem.emissiveIntensity = bf * 0.6;
      if (brainM.current) brainM.current.scale.setScalar(HEAD_S * (1 + 0.04 * bf));
      // موج صدا
      if (rings.current) {
        rings.current.children.forEach((ch, i) => {
          const k = clamp((t - 0.06 - i * 0.025) / 0.15);
          const mesh = ch as THREE.Mesh;
          mesh.visible = k > 0 && k < 1;
          mesh.scale.setScalar(0.05 + k * 1.75);
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - k);
        });
      }
    }
  });

  const showSkinEdge = xray;
  void showSkinEdge;

  const ik = useMemo(() => {
    const R = ARM_REST.R;
    const sh = new THREE.Vector3(...R.sh), el = new THREE.Vector3(...R.el), wr = new THREE.Vector3(...R.wr);
    return {
      sh, el, wr, a: sh.distanceTo(el), b: el.distanceTo(wr),
      dU: el.clone().sub(sh).normalize(), dF: wr.clone().sub(el).normalize(),
      X: new THREE.Matrix4(), inv: new THREE.Matrix4().makeTranslation(0, -PY, 0),
      S: new THREE.Vector3(), E: new THREE.Vector3(), W: new THREE.Vector3(), Wr: new THREE.Vector3(), P: new THREE.Vector3(), d: new THREE.Vector3(), pole: new THREE.Vector3(), perp: new THREE.Vector3(), nd: new THREE.Vector3(),
      q: new THREE.Quaternion(), M: new THREE.Matrix4(), land: new THREE.Vector3(...PENCIL_LAND), rest: new THREE.Vector3(...PENCIL_REST),
    };
  }, []);

  useFrame(() => {
    const [pelvis, spine, armU, armF, shinB] = body.bones;
    pelvis.matrix.identity();
    if (upper.current) { upper.current.updateWorldMatrix(true, false); spine.matrix.copy(upper.current.matrixWorld); } else spine.matrix.makeTranslation(0, PY, 0);
    if (shin.current) { shin.current.updateWorldMatrix(true, false); shinB.matrix.copy(shin.current.matrixWorld); }

    // بازوی راست: دو‌استخوانه (IK) از شانه تا مچ؛ در حالت استراحت دست روی ران است
    const { reach, tk } = armCtl.current;
    ik.X.copy(spine.matrix).multiply(ik.inv);
    ik.S.copy(ik.sh).applyMatrix4(ik.X); ik.E.copy(ik.el).applyMatrix4(ik.X); ik.Wr.copy(ik.wr).applyMatrix4(ik.X);
    ik.P.copy(ik.land).lerp(ik.rest, tk);
    ik.d.copy(ik.P).sub(ik.S).normalize();
    ik.W.copy(ik.P).addScaledVector(ik.d, -HAND_LEN).lerp(ik.Wr, 0); // مچ هدف
    ik.W.copy(ik.Wr).lerp(ik.W, reach);
    ik.d.copy(ik.W).sub(ik.S);
    let dist = ik.d.length();
    const maxD = ik.a + ik.b - 0.004;
    if (dist > maxD) { ik.d.multiplyScalar(maxD / dist); dist = maxD; ik.W.copy(ik.S).add(ik.d); }
    ik.d.normalize();
    const xx = (ik.a * ik.a - ik.b * ik.b + dist * dist) / (2 * dist);
    const hh = Math.sqrt(Math.max(ik.a * ik.a - xx * xx, 0));
    ik.pole.copy(ik.E).sub(ik.S);
    ik.perp.copy(ik.pole).addScaledVector(ik.d, -ik.pole.dot(ik.d));
    if (ik.perp.lengthSq() < 1e-8) ik.perp.set(0, 0, 1);
    ik.perp.normalize();
    ik.E.copy(ik.S).addScaledVector(ik.d, xx).addScaledVector(ik.perp, hh);
    ik.nd.copy(ik.E).sub(ik.S).normalize();
    ik.q.setFromUnitVectors(ik.dU, ik.nd);
    armU.matrix.compose(ik.S, ik.q, new THREE.Vector3(1, 1, 1));
    ik.nd.copy(ik.W).sub(ik.E).normalize();
    ik.q.setFromUnitVectors(ik.dF, ik.nd);
    armF.matrix.compose(ik.E, ik.q, new THREE.Vector3(1, 1, 1));
    handPose.current.w.copy(ik.W); handPose.current.f.copy(ik.nd);
    if (bicepsG.current) bicepsG.current.matrix.copy(armU.matrix).multiply(body.inv[2]);
    body.bones.forEach((b) => b.matrixWorld.copy(b.matrix));
  });

  return (
    <>
      <color attach="background" args={["#0a1428"]} />
      <fog attach="fog" args={["#0a1428", 6, 12]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#bcd3ff", "#26324a", 0.7]} />
      <directionalLight position={[3, 4.5, 3]} intensity={2.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.7} color="#7ea6ff" />
      <OrbitControls target={[0.3, 0.84, 0.12]} enablePan={false} minDistance={1.3} maxDistance={5.5} maxPolarAngle={Math.PI / 2 + 0.05} />

      <primitive object={body.mesh} />
      <primitive object={body.hands} />
      {/* کف */}
      <mesh rotation-x={-Math.PI / 2} position={[0.2, -0.002, 0.1]}><circleGeometry args={[2.6, 64]} /><meshStandardMaterial color="#122038" roughness={0.9} /></mesh>
      {[0.8, 1.4, 2.0].map((r) => (
        <mesh key={r} rotation-x={-Math.PI / 2} position={[0.2, 0.001, 0.1]}><ringGeometry args={[r, r + 0.008, 96]} /><meshBasicMaterial color="#2a4272" /></mesh>
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0.15, 0.003, 0]} scale={[1.7, 1.45, 1]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={blob} transparent depthWrite={false} /></mesh>

      {/* صندلی */}
      <mesh position={[0, 0.4, 0]} material={m.chair}><boxGeometry args={[0.52, 0.04, 0.5]} /></mesh>
      <mesh position={[-0.25, 0.65, 0]} material={m.chair}><boxGeometry args={[0.035, 0.46, 0.5]} /></mesh>
      {([[-0.22, -0.22], [-0.22, 0.22], [0.22, -0.22], [0.22, 0.22]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} material={m.chair}><cylinderGeometry args={[0.018, 0.018, 0.4, 10]} /></mesh>
      ))}

      {/* میز (فقط در حالت ارادی) */}
      {!reflex && (
        <group>
          <mesh position={[0.78, 0.74, -0.1]} material={m.wood}><boxGeometry args={[0.66, 0.035, 1.4]} /></mesh>
          {[-0.7, 0.45].map((z) => <mesh key={z} position={[1.06, 0.37, z]} material={m.wood}><boxGeometry args={[0.04, 0.74, 0.04]} /></mesh>)}
        </group>
      )}

      {/* ───── پاها (ثابت) ───── */}
      {/* پای زیرین */}
      <mesh position={[0.42, 0.04, -0.17]} material={m.shoe}><boxGeometry args={[0.22, 0.07, 0.1]} /></mesh>
      {/* ران پای رویی */}
      {/* ماهیچه‌ی چهارسر و زردپی */}
      <mesh ref={quad} position={along(0.5, [0, 0.02, 0])} quaternion={tmp.quadAxis} material={m.muscle} scale={[0.3, 0.034, 0.04]}><sphereGeometry args={[1, 24, 16]} /></mesh>
      <Limb a={along(0.8, [0, 0.02, 0])} b={[K_T[0] + 0.03, K_T[1] + 0.025, K_T[2]]} r1={0.008} r2={0.008} mat={m.tendon} />

      {/* ساق پای رویی (می‌چرخد) */}
      <group ref={shin} position={K_T} rotation-z={A0}>
        <mesh position={[0.075, -SHIN_LEN - 0.02, 0]} material={m.shoe}><boxGeometry args={[0.22, 0.07, 0.1]} /></mesh>
        <Ball p={[0.032, 0.008, 0]} r={0.03} mat={m.tendon} s={[0.55, 1, 1]} />
        <Limb a={[0.03, -0.022, 0]} b={[0.033, -0.08, 0]} r1={0.007} r2={0.007} mat={m.tendon} />
        <mesh ref={recept} position={[0.035, -0.072, 0]} material={m.receptor}><sphereGeometry args={[0.011, 16, 12]} /></mesh>
      </group>

      {/* چکش */}
      {reflex && (
        <group ref={hammer} position={[0.95, 0.78, -0.06]} rotation-z={2.55}>
          <mesh position={[0.24, 0, 0]} rotation-z={Math.PI / 2} material={m.hammer}><cylinderGeometry args={[0.011, 0.011, 0.48, 12]} /></mesh>
          <mesh position={[0.5, 0, 0]} material={m.rubber}><cylinderGeometry args={[0.028, 0.034, 0.1, 18]} /></mesh>
          <mesh position={[0.5, 0, 0]} rotation-z={Math.PI / 2} material={m.hammer}><cylinderGeometry args={[0.032, 0.032, 0.02, 18]} /></mesh>
        </group>
      )}

      <group ref={bicepsG} matrixAutoUpdate={false}>
        <mesh ref={biceps} position={[0.026, 0.94, 0.222]} material={m.muscle} scale={[0.02, 0.1, 0.024]}><sphereGeometry args={[1, 18, 12]} /></mesh>
      </group>

      {/* ───── تنه (برای حالت ارادی خم می‌شود) ───── */}
      <group ref={upper} position={[0, PY, 0]}>

        {/* مغز واقع‌نما: مخ، مخچه و ساقه‌ی مغز */}
        <group ref={brainM} position={U(HEAD_O[0], HEAD_O[1], HEAD_O[2])} scale={HEAD_S}>
          <mesh geometry={anat.hemR} material={[m.brain, m.brain]} />
          <mesh geometry={anat.hemL} material={[m.brain, m.brain]} />
          <mesh geometry={anat.cereb} material={m.cereb} />
          <mesh geometry={anat.stem} material={m.stem} />
        </group>
        {/* چشم‌ها */}
        {[-1, 1].map((sd) => (
          <group key={sd} position={U(...HP(1.07, -0.18, sd * 0.34))} scale={HEAD_S / 0.1}>
            <mesh><sphereGeometry args={[0.0095, 14, 10]} /><meshStandardMaterial color="#f6f2ec" roughness={0.3} /></mesh>
            <mesh position={[0.0065, 0, 0]}><sphereGeometry args={[0.0055, 10, 8]} /><meshStandardMaterial color="#2b1d16" roughness={0.3} /></mesh>
          </group>
        ))}
        {/* نخاع: طناب سفید با برجستگی‌های گردنی و کمری، ریشه‌های عصبی و مخروط انتهایی */}
        <group position={U(0, CORD[0][1], 0)}>
          <mesh geometry={anat.cord} material={m.cord} />
          <mesh geometry={anat.roots} material={m.root} />
        </group>

        {/* مسیر پیام در حالت ارادی */}
        {!reflex && (
          <>
            <Nerve pts={EAR_BRAIN} color={SENSE} get={() => (T() - 0.18) / 0.1} fade={() => 1 - ramp(T(), 0.9, 0.98)} r={0.006} glowR={0.025} />
            <Nerve pts={BRAIN_ARM} color={MOTOR} get={() => (T() - 0.4) / 0.18} fade={() => 1 - ramp(T(), 0.9, 0.98)} r={0.0065} glowR={0.03} />
            <Label text="گوش" at={U(-0.05, 1.5, 0.42)} to={U(...HP(-0.2, -0.5, 1.15))} show={names} color={SENSE} />
            <Label text="مغز" at={U(0.3, 1.53, -0.2)} to={U(...HP(0.1, 0.1, 0))} show={names} color="#f0abfc" />
            <Label text="نخاع" at={U(-0.38, 1.0, -0.15)} to={U(-0.055, 1.0, 0)} show={names} color="#93c5fd" />
            <Label text="عصب حرکتی" at={U(0.28, 1.2, 0.42)} to={U(0.02, 1.04, 0.19)} show={names} color={MOTOR} />
            <Label text="ماهیچه‌ی بازو" at={U(0.34, 0.82, 0.42)} to={U(0.03, 0.9, 0.222)} show={names} color="#fca5a5" />
          </>
        )}
      </group>

      {/* ───── مسیر پیام در انعکاس ───── */}
      {reflex && (
        <>
          <Nerve pts={SENS_R} color={SENSE} get={() => (T() - 0.14) / 0.28} fade={() => 1 - ramp(T(), 0.93, 1)} />
          <Nerve pts={MOTO_R} color={MOTOR} get={() => (T() - 0.52) / 0.22} fade={() => 1 - ramp(T(), 0.93, 1)} />
          <Nerve pts={CORD_UP} color="#a1a1aa" get={() => (T() - 0.54) / 0.34} fade={() => 1 - ramp(T(), 0.93, 1)} r={0.006} glowR={0.025} />
          <mesh ref={cordGlow} position={[-0.05, 0.68, 0.01]} visible={false}><sphereGeometry args={[0.05, 20, 14]} /><meshBasicMaterial color={GLOW} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} /></mesh>
          <Label text="چکش" at={[1.1, 1.1, -0.06]} to={[0.95, 0.8, -0.06]} show={names} color="#cbd5e1" />
          <Label text="گیرنده‌ی زانو" at={[0.82, 0.3, 0.3]} to={STRIKE} show={names} color={SENSE} />
          <Label text="عصب حسی" at={[0.55, 0.3, 0.55]} to={along(0.55, [0, -0.02, 0.014])} show={names} color={SENSE} />
          <Label text="ماهیچه‌ی ران" at={[0.5, 1.02, 0.3]} to={along(0.5, [0, 0.05, 0.02])} show={names} color="#fca5a5" />
          <Label text="عصب حرکتی" at={[-0.3, 0.4, 0.5]} to={along(0.12, [0, 0.02, 0.03])} show={names} color={MOTOR} />
          <Label text="نخاع" at={[-0.5, 1.1, 0.2]} to={[-0.06, 0.9, 0]} show={names} color="#93c5fd" />
          <Label text="مغز" at={[0.4, 1.55, 0.25]} to={HP(0.1, 0.3, 0)} show={names} color="#f0abfc" />
        </>
      )}

      {/* مداد و موج صدا */}
      {!reflex && (
        <>
          <group ref={pencil} position={PENCIL_REST} rotation={[0, 0, Math.PI / 2]}>
            <mesh material={m.pencil}><cylinderGeometry args={[0.006, 0.006, 0.18, 8]} /></mesh>
            <mesh position={[0, 0.1, 0]} material={m.tendon}><coneGeometry args={[0.006, 0.02, 8]} /></mesh>
            <mesh position={[0, -0.095, 0]} material={m.rubber}><cylinderGeometry args={[0.0062, 0.0062, 0.015, 8]} /></mesh>
          </group>
          <Label text="مداد" at={[0.2, 0.2, 1.05]} to={[0.5, 0.05, 0.66]} show={names} color="#fde047" />
          <group ref={rings} position={PENCIL_LAND}>
            {[0, 1, 2].map((i) => (
              <mesh key={i} visible={false}><sphereGeometry args={[1, 28, 18]} /><meshBasicMaterial color="#7dd3fc" transparent opacity={0.3} depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} /></mesh>
            ))}
          </group>
        </>
      )}
    </>
  );
});

/** فعالیت صفحه‌ی ۲۹: انعکاس زانو (غیرارادی) و برداشتن مداد (ارادی) به‌صورت سه‌بعدی. */
export default function ReflexArc() {
  const [mode, setMode] = useState<Mode>("reflex");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [xray, setXray] = useState(true);
  const [names, setNames] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const playRef = useRef(false);
  playRef.current = playing;
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const n = box.current;
    if (!n) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(n);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playRef.current && tRef.current < 1) {
        tRef.current = Math.min(1, tRef.current + (dt / DURATION[modeRef.current]) * (tRef.current < (modeRef.current === "reflex" ? 0.15 : 0.1) ? 2.4 : 1));
        acc += dt;
        if (acc > 0.08 || tRef.current >= 1) { acc = 0; setT(tRef.current); }
        if (tRef.current >= 1) setPlaying(false);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  const seek = (v: number) => { tRef.current = v; setT(v); setPlaying(false); };
  const toggle = () => { if (t >= 1) { tRef.current = 0; setT(0); setPlaying(true); } else setPlaying((p) => !p); };
  const stages = MODES[mode].stages;
  const stage = stages.find((s) => t <= s.to) ?? stages[stages.length - 1];
  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm ${on ? "bg-orange-400 font-bold text-slate-900" : "bg-white/10 text-white hover:bg-white/20"}`;
  const tog = (on: boolean) => `inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs backdrop-blur ${on ? "bg-orange-400 text-slate-900" : "bg-black/55 text-slate-100 hover:bg-black/70"}`;

  return (
    <div ref={box} className="space-y-3 rounded-2xl bg-slate-900 p-3 text-slate-100">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(MODES) as Mode[]).map((k) => (
          <button key={k} className={tab(mode === k)} onClick={() => { setMode(k); seek(0); }}>{MODES[k].label}</button>
        ))}
      </div>
      <LazyCanvas
        gl={{ stencil: true, antialias: true }}
        camera={{ position: [1.55, 1.1, 2.1], fov: 38 }}
        label="شبیه‌سازی سه‌بعدی مسیر پیام عصبی در فعالیت ارادی و غیرارادی"
        className="h-[26rem] md:h-[34rem]"
        overlay={
          <>
            <div className="absolute start-2 top-2 flex gap-1.5" dir="rtl">
              <button className={tog(xray)} onClick={() => setXray((x) => !x)} aria-pressed={xray}><Eye className="size-3.5" aria-hidden="true" /> درون بدن</button>
              <button className={tog(names)} onClick={() => setNames((x) => !x)} aria-pressed={names}><Tag className="size-3.5" aria-hidden="true" /> نام‌ها</button>
            </div>
            <div className="pointer-events-none absolute bottom-2 end-2 space-y-1 rounded-lg bg-black/45 px-2.5 py-1.5 text-[11px] backdrop-blur" dir="rtl">
              <p className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: SENSE }} />پیام حسی</p>
              <p className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: MOTOR }} />پیام حرکتی</p>
              <p className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: GLOW }} />پیام در حال حرکت</p>
            </div>
            <p className="pointer-events-none absolute bottom-2 start-2 text-[11px] text-slate-400" dir="rtl">بکشید تا بچرخد</p>
          </>
        }
      >
        <Scene mode={mode} tRef={tRef} xray={xray} names={names} />
      </LazyCanvas>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-400 px-4 py-1.5 text-sm font-semibold text-slate-950">
          {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          {playing ? "توقف" : t >= 1 ? "تکرار" : t > 0 ? "ادامه" : "شروع"}
        </button>
        <button onClick={() => seek(0)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"><RotateCcw className="size-4" aria-hidden="true" /> از اول</button>
        <input type="range" min="0" max="1" step="0.002" value={t} onChange={(e) => seek(Number(e.target.value))} aria-label="پیشرفت" className="min-w-[8rem] flex-1 accent-orange-400" />
      </div>
      <div className="rounded-xl bg-white/[0.05] p-3 text-sm leading-7" aria-live="polite">
        <p className="mb-1 font-bold text-orange-300">{stage.title}</p>
        <p>{stage.text}</p>
      </div>
    </div>
  );
}
