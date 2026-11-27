import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Scissors } from "lucide-react";
import { buildProfileHead } from "./body/headGeo";
import { LazyCanvas } from "./LazyCanvas";
import {
  buildCerebellum, buildCord, buildHemisphere, buildStem, CEREB_C, paintCerebellumCut, paintMedial, type CerebrumGeo,
} from "./body/brainGeo";

type V3 = [number, number, number];
type Key = "cerebrum" | "frontal" | "parietal" | "occipital" | "temporal" | "cerebellum" | "vermis" | "stem" | "medulla" | "cord";
type View = "centers" | "cortex" | "cerebellum" | "stem";

const LOBE_COLORS: Record<string, string> = { frontal: "#ee5a5a", parietal: "#a98adf", occipital: "#46b98a", temporal: "#f4b648" };
const LOBE_KEYS = ["frontal", "parietal", "occipital", "temporal"] as const;
const DOT: Record<Key, string> = {
  cerebrum: "#f1cf66", frontal: LOBE_COLORS.frontal, parietal: LOBE_COLORS.parietal, occipital: LOBE_COLORS.occipital, temporal: LOBE_COLORS.temporal,
  cerebellum: "#6dbd75", vermis: "#86b3c7", stem: "#f0a9b4", medulla: "#f59e42", cord: "#f5e6a0",
};

interface Info { title: string; where: string; text: string; extra?: string }
const INFO: Record<Key, Info> = {
  cerebrum: { title: "مخ", where: "بزرگ‌ترین بخش مغز", text: "بیشتر حجم مغز ما را نیمکره‌های مخ تشکیل می‌دهند. نیمکره‌های مخ اطلاعات اندام‌های حسی مانند چشم، گوش، پوست، بینی و زبان را دریافت می‌کنند و دستورهای لازم را برای بخش‌های گوناگون بدن مانند ماهیچه‌ها می‌فرستند. همچنین نیمکره‌های مخ به ما توانایی فکرکردن، حرف‌زدن و حل مسئله را می‌دهند. نیمکره‌ی چپ فعالیت‌های نیمه‌ی راست بدن و نیمکره‌ی راست فعالیت‌های نیمه‌ی چپ بدن را کنترل (واپایش) می‌کند؛ ولی با هم مرتبط‌اند." },
  frontal: { title: "بخش پیشانی", where: "قشر مخ", text: "بخشی از قشر مخ در جلوی نیمکره‌ها (شکل ۳ کتاب). قشر مخ، بخش خاکستری‌رنگ و بیرونی نیمکره‌های مخ و مرکز بسیاری از اعمال ارادی بدن است.", extra: "اطلاعات تکمیلی: در تصمیم‌گیری، برنامه‌ریزی و فرمان حرکت‌های ارادی نقش مهمی دارد." },
  parietal: { title: "بخش آهیانه", where: "قشر مخ", text: "بخشی از قشر مخ در بالا و میانه‌ی نیمکره‌ها (شکل ۳ کتاب). بسیاری از اعمال ارادی بدن از قشر مخ کنترل می‌شود.", extra: "اطلاعات تکمیلی: اطلاعات حس لامسه (پوست) را پردازش می‌کند." },
  occipital: { title: "بخش پس‌سری", where: "قشر مخ", text: "بخشی از قشر مخ در پشت نیمکره‌ها (شکل ۳ کتاب).", extra: "اطلاعات تکمیلی: مرکز اصلی پردازش اطلاعات بینایی است." },
  temporal: { title: "بخش گیجگاهی", where: "قشر مخ", text: "بخشی از قشر مخ در کنار نیمکره‌ها، نزدیک گیج‌گاه (شکل ۳ کتاب).", extra: "اطلاعات تکمیلی: در شنوایی و حافظه نقش دارد." },
  cerebellum: { title: "مخچه", where: "زیر مخ، پشت سر", text: "هنگام ورزش، بدن شما در جهت‌های مختلف حرکت می‌کند و در همان حال باید تعادل خود را حفظ کند. پیام‌هایی از چشم، گوش و پوست برای مراکز عصبی، به‌ویژه مخچه، فرستاده می‌شود. مخچه با بررسی این اطلاعات، پیام حرکتی را برای ماهیچه‌ها می‌فرستد که با انقباض آن‌ها تعادل بدن در هر حالتی حفظ می‌شود. بندبازان و ژیمناستیک‌کاران با تمرین بیشتر مخچه‌ی خود را تقویت کرده‌اند." },
  vermis: { title: "کرمینه", where: "بخش میانی مخچه", text: "مخچه دو نیمکره‌ی راست و چپ و بخشی میانی به نام کرمینه دارد (شکل ۴ کتاب)." },
  stem: { title: "ساقه‌ی مغز", where: "زیر مخ", text: "بخش ساقه‌مانندی در زیر مخ است که مخ و مخچه را به نخاع وصل می‌کند. به این بخش ساقه‌ی مغز می‌گویند (شکل ۶ کتاب)." },
  medulla: { title: "بصل‌النخاع", where: "بخشی از ساقه‌ی مغز، بالای نخاع", text: "بخشی از ساقه‌ی مغز، بصل‌النخاع است که در بالای نخاع قرار دارد و مرکز کنترل فعالیت‌های غیرارادی مثل تنفس، ضربان قلب و فشار خون است. با توجه به اهمیت آن به این مرکز در بصل‌النخاع «گره حیات» گفته می‌شود." },
  cord: { title: "نخاع", where: "درون ستون مهره‌ها", text: "نخاع درون کانال ستون مهره قرار دارد. از بصل‌النخاع شروع می‌شود و رابط مغز و اعصاب بدن است." },
};

interface Label { text: string; key: Key; to: V3; off: [number, number] }
interface ViewCfg {
  tab: string; caption: string; intro: string; chips: Key[]; pos: V3; target: V3; labels: Label[]; cut: boolean;
}
const VIEWS: Record<View, ViewCfg> = {
  centers: {
    tab: "شکل ۲ـ مراکز عصبی", caption: "شکل ۲ـ مراکز عصبی: مغز درون جمجمه و نخاع درون ستون مهره‌ها",
    intro: "مغز درون جمجمه و نخاع درون کانال ستون مهره قرار دارد. مغز شامل نیمکره‌های مخ، مخچه و ساقه‌ی مغز است. روی هر بخش بزنید.",
    chips: ["cerebrum", "cerebellum", "stem", "cord"], pos: [0.1, -0.2, 6.7], target: [0.1, -0.95, 0], cut: false,
    labels: [
      { text: "مخ", key: "cerebrum", to: [0.35, 0.5, 0.78], off: [0.12, -0.2] },
      { text: "مخچه", key: "cerebellum", to: [-0.62, -0.62, 0.45], off: [-0.28, 0.06] },
      { text: "ساقه‌ی مغز", key: "stem", to: [0.0, -0.62, 0.1], off: [0.28, 0.06] },
      { text: "نخاع", key: "cord", to: [-0.22, -2.3, 0.06], off: [-0.22, 0.04] },
    ],
  },
  cortex: {
    tab: "شکل ۳ـ بخش‌های قشر مخ", caption: "شکل ۳ـ بخش‌های قشر مخ: پیشانی، آهیانه، پس‌سری و گیجگاهی",
    intro: "قشر مخ، بخش خاکستری‌رنگ و بیرونی نیمکره‌های مخ است و مرکز بسیاری از اعمال ارادی بدن. هر بخش را با رنگش بشناسید و روی آن بزنید.",
    chips: ["frontal", "parietal", "occipital", "temporal"], pos: [-0.5, 0.75, -4.1], target: [0, -0.15, 0], cut: false,
    labels: [
      { text: "پیشانی", key: "frontal", to: [0.62, 0.22, -0.64], off: [-0.27, -0.14] },
      { text: "آهیانه", key: "parietal", to: [-0.2, 0.52, -0.64], off: [0.0, -0.22] },
      { text: "پس‌سری", key: "occipital", to: [-0.86, 0.08, -0.45], off: [0.25, -0.16] },
      { text: "گیجگاهی", key: "temporal", to: [0.15, -0.38, -0.78], off: [-0.2, 0.24] },
    ],
  },
  cerebellum: {
    tab: "شکل ۴ـ مخچه", caption: "شکل ۴ـ مخچه: نیمکره‌ی راست و چپ و کرمینه (نمای پشت)",
    intro: "مخچه دو نیمکره‌ی راست و چپ و بخشی میانی به نام کرمینه دارد. با «برش از وسط» درون آن را هم ببینید.",
    chips: ["cerebellum", "vermis"], pos: [-3.3, -0.15, 0.6], target: [CEREB_C[0], CEREB_C[1], 0], cut: false,
    labels: [
      { text: "کرمینه", key: "vermis", to: [-1.04, -0.5, 0.0], off: [0.0, -0.22] },
      { text: "نیمکره‌ی راست", key: "cerebellum", to: [-1.0, -0.65, 0.38], off: [0.2, 0.2] },
      { text: "نیمکره‌ی چپ", key: "cerebellum", to: [-1.0, -0.65, -0.38], off: [-0.2, 0.2] },
    ],
  },
  stem: {
    tab: "شکل ۶ـ ساقه‌ی مغز", caption: "شکل ۶ـ ساقه‌ی مغز و بصل‌النخاع (برش از وسط)",
    intro: "ساقه‌ی مغز، مخ و مخچه را به نخاع وصل می‌کند. بخشی از آن، بصل‌النخاع، مرکز کنترل تنفس، ضربان قلب و فشار خون است.",
    chips: ["stem", "medulla", "cerebellum", "cerebrum"], pos: [0.1, -0.2, 4.3], target: [-0.05, -0.55, 0], cut: true,
    labels: [
      { text: "ساقه‌ی مغز", key: "stem", to: [0.0, -0.62, 0.0], off: [0.26, 0.0] },
      { text: "بصل‌النخاع", key: "medulla", to: [-0.14, -1.2, 0.0], off: [0.26, 0.05] },
      { text: "مخچه", key: "cerebellum", to: [-0.8, -0.6, 0.0], off: [-0.24, 0.0] },
      { text: "مخ", key: "cerebrum", to: [0.3, 0.3, -0.03], off: [0.2, -0.22] },
    ],
  },
};

/* ───────── رنگ‌ها ───────── */
const gray = new THREE.Color("#8d96a6");
function tone(base: string, active: boolean, dimmed: boolean, cavity: number, out: THREE.Color) {
  out.set(base);
  if (active) out.lerp(new THREE.Color("#ffffff"), 0.22);
  if (dimmed) out.lerp(gray, 0.58);
  out.multiplyScalar(1 - 0.34 * cavity);
}

interface Ctl { view: View; sel: Key | null; hover: Key | null }
const cerebrumKey = (view: View, lobe: number): Key => (view === "cortex" ? LOBE_KEYS[lobe] : "cerebrum");
const cerebrumBase = (view: View, lobe: number): string =>
  view === "cortex" ? LOBE_COLORS[LOBE_KEYS[lobe]] : view === "centers" ? "#f1cf66" : view === "cerebellum" ? "#e4cbbd" : "#e6b3a8";
const cerebBase = (view: View, vermis: boolean) =>
  view === "centers" ? "#6dbd75" : view === "cortex" ? "#5f9fc9" : view === "cerebellum" ? (vermis ? "#86b3c7" : "#dbb27c") : "#d9a39c";
const stemBase = (view: View, part: number) =>
  view === "centers" ? "#f0a9b4" : view === "stem" ? (part === 2 ? "#f59e42" : "#e9cbb0") : view === "cortex" ? "#d8c0ac" : "#c9b4a0";
const cordBase = (view: View) => (view === "cortex" || view === "cerebellum" ? "#e6d9a8" : "#f5e6a0");

function paintColors(geo: THREE.BufferGeometry, ctl: Ctl, keyOf: (i: number) => Key, baseOf: (i: number) => string) {
  const n = geo.attributes.position.count;
  const cav = geo.attributes.cavity as THREE.BufferAttribute | undefined;
  let col = geo.attributes.color as THREE.BufferAttribute | undefined;
  if (!col) { col = new THREE.BufferAttribute(new Float32Array(n * 3), 3); geo.setAttribute("color", col); }
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const k = keyOf(i);
    const active = ctl.sel === k || ctl.hover === k;
    const dimmed = ctl.sel !== null && ctl.sel !== k && ctl.hover !== k;
    tone(baseOf(i), active, dimmed, cav ? cav.getX(i) : 0, c);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

/* ───────── دوربین ───────── */
function Rig({ view }: { view: View }) {
  const ctl = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);
  const { camera } = useThree();
  const anim = useRef(true);
  const cfg = VIEWS[view];
  const goal = useMemo(() => ({ pos: new THREE.Vector3(...cfg.pos), target: new THREE.Vector3(...cfg.target) }), [cfg]);
  useEffect(() => { anim.current = true; }, [view]);
  useFrame(() => {
    const c = ctl.current;
    if (!anim.current || !c) return;
    camera.position.lerp(goal.pos, 0.07);
    c.target.lerp(goal.target, 0.07);
    c.update();
    if (camera.position.distanceTo(goal.pos) < 0.01) anim.current = false;
  });
  return (
    <OrbitControls
      ref={ctl as never}
      enablePan={false} enableDamping minDistance={1.6} maxDistance={9}
      onStart={() => { anim.current = false; }}
    />
  );
}

/* ───────── صحنه ───────── */
interface Bridge { els: (HTMLElement | null)[]; lines: (SVGLineElement | null)[] }
interface SceneProps { view: View; sel: Key | null; hover: Key | null; cut: boolean; setHover: (k: Key | null) => void; onPick: (k: Key) => void; bridge: React.MutableRefObject<Bridge> }

const Scene = memo(function Scene({ view, sel, hover, cut, setHover, onPick, bridge }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const tmpV = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), []);

  const hemis = useMemo<{ r: CerebrumGeo; l: CerebrumGeo }>(() => ({ r: buildHemisphere(1), l: buildHemisphere(-1) }), []);
  const cereb = useMemo(() => buildCerebellum(), []);
  const stem = useMemo(() => buildStem(), []);
  const cordG = useMemo(() => buildCord(), []);
  const head = useMemo(() => buildProfileHead(), []);
  const medial = useMemo(() => paintMedial(hemis.l.geometry, hemis.l.capStart, hemis.l.capCount), [hemis]);
  const cerebCut = useMemo(() => paintCerebellumCut(), []);

  const ctl: Ctl = { view, sel, hover };
  const ghost = view === "cerebellum";

  // رنگ‌آمیزی رأس‌ها
  useEffect(() => {
    for (const h of [hemis.r.geometry, hemis.l.geometry]) {
      const lobe = h.attributes.lobe as THREE.BufferAttribute;
      paintColors(h, ctl, (i) => cerebrumKey(view, lobe.getX(i)), (i) => cerebrumBase(view, lobe.getX(i)));
    }
    const part = cereb.attributes.part as THREE.BufferAttribute;
    paintColors(cereb, ctl, (i) => (view === "cerebellum" && part.getX(i) === 1 ? "vermis" : "cerebellum"), (i) => cerebBase(view, part.getX(i) === 1));
    const sp = stem.attributes.part as THREE.BufferAttribute;
    paintColors(stem, ctl, (i) => (view === "stem" && sp.getX(i) === 2 ? "medulla" : "stem"), (i) => stemBase(view, sp.getX(i)));
    paintColors(cordG.cord, ctl, () => "cord", () => cordBase(view));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sel, hover, hemis, cereb, stem, cordG]);

  const mats = useMemo(() => {
    const phys = (extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45, ...extra });
    return {
      cerebrum: phys(),
      cap: new THREE.MeshStandardMaterial({ map: medial, emissiveMap: medial, emissive: "#ffffff", emissiveIntensity: 0.45, roughness: 0.7 }),
      cereb: phys({ roughness: 0.62 }),
      stem: phys({ roughness: 0.55 }),
      cord: phys({ roughness: 0.55 }),
      roots: new THREE.MeshStandardMaterial({ color: "#eadba5", roughness: 0.6 }),
      cerebCap: new THREE.MeshStandardMaterial({ map: cerebCut, roughness: 0.7 }),
      head: new THREE.MeshStandardMaterial({ color: "#eeb49f", roughness: 0.5, transparent: true, opacity: 0.34, depthWrite: false }),
      headRim: new THREE.MeshBasicMaterial({ color: "#d4806a", transparent: true, opacity: 0.3, side: THREE.BackSide, depthWrite: false }),
    };
  }, [medial, cerebCut]);

  // برش و شفافیت
  useEffect(() => {
    const clip = cut ? [plane] : [];
    for (const k of ["cereb", "stem", "cord", "roots"] as const) { mats[k].clippingPlanes = clip; mats[k].side = cut ? THREE.DoubleSide : THREE.FrontSide; mats[k].needsUpdate = true; }
    const op = ghost ? 0.09 : 1;
    for (const m of [mats.cerebrum, mats.cap]) { m.transparent = op < 1; m.opacity = op; m.depthWrite = op >= 1; m.needsUpdate = true; }
  }, [cut, ghost, mats, plane]);

  const hov = (key: Key | null) => (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(key); document.body.style.cursor = "pointer"; };
  const out = () => { setHover(null); document.body.style.cursor = ""; };
  const lobeAt = (geo: THREE.BufferGeometry, e: ThreeEvent<PointerEvent | MouseEvent>): Key | null => {
    const f = e.face; if (!f) return null;
    return cerebrumKey(view, (geo.attributes.lobe as THREE.BufferAttribute).getX(f.a));
  };
  const partOfStem = (e: ThreeEvent<PointerEvent | MouseEvent>): Key => {
    const f = e.face; return view === "stem" && (stem.attributes.part as THREE.BufferAttribute).getX(f!.a) === 2 ? "medulla" : "stem";
  };
  const cerebKey = (e: ThreeEvent<PointerEvent | MouseEvent>): Key => {
    const f = e.face; return view === "cerebellum" && (cereb.attributes.part as THREE.BufferAttribute).getX(f!.a) === 1 ? "vermis" : "cerebellum";
  };

  const cfg = VIEWS[view];
  useFrame(({ camera, size }) => {
    const { els, lines } = bridge.current;
    cfg.labels.forEach((l, i) => {
      const el = els[i], ln = lines[i];
      if (!el || !ln) return;
      tmpV.set(...l.to).project(camera);
      const ax = ((tmpV.x + 1) / 2) * size.width, ay = ((1 - tmpV.y) / 2) * size.height;
      const lx = Math.min(size.width - 44, Math.max(44, ax + l.off[0] * size.width)), ly = Math.min(size.height - 16, Math.max(16, ay + l.off[1] * size.height));
      el.style.transform = `translate(${lx}px, ${ly}px) translate(-50%, -50%)`;
      ln.setAttribute("x1", String(lx)); ln.setAttribute("y1", String(ly)); ln.setAttribute("x2", String(ax)); ln.setAttribute("y2", String(ay));
    });
  });
  return (
    <>
      <color attach="background" args={["#eef3fb"]} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#ffffff", "#b9c6e0", 0.7]} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-4, 1, -3]} intensity={0.9} color="#ffe9d6" />
      <directionalLight position={[0, -4, 2]} intensity={0.35} />
      <Rig view={view} />

      {/* سر (فقط شکل ۲) */}
      {view === "centers" && !cut && (
        <group>
          <mesh geometry={head} material={mats.head} renderOrder={5} />
          <mesh geometry={head} material={mats.headRim} scale={1.01} renderOrder={4} />
          {[-1, 1].map((sd) => (
            <group key={sd} position={[0.99, -0.2, sd * 0.31]} renderOrder={6}>
              <mesh><sphereGeometry args={[0.07, 16, 12]} /><meshStandardMaterial color="#f8f4ee" roughness={0.3} /></mesh>
              <mesh position={[0.045, 0, sd * 0.012]}><sphereGeometry args={[0.035, 12, 10]} /><meshStandardMaterial color="#3b2a22" roughness={0.3} /></mesh>
            </group>
          ))}
        </group>
      )}

      {/* مخ */}
      {!cut && (
        <mesh geometry={hemis.r.geometry} material={[mats.cerebrum, mats.cap]}
          onPointerMove={(e) => { e.stopPropagation(); setHover(lobeAt(hemis.r.geometry, e)); document.body.style.cursor = "pointer"; }}
          onPointerOut={out} onClick={(e) => { e.stopPropagation(); const k = lobeAt(hemis.r.geometry, e); if (k) onPick(k); }} />
      )}
      <mesh geometry={hemis.l.geometry} material={[mats.cerebrum, mats.cap]}
        onPointerMove={(e) => { e.stopPropagation(); setHover(lobeAt(hemis.l.geometry, e)); document.body.style.cursor = "pointer"; }}
        onPointerOut={out} onClick={(e) => { e.stopPropagation(); const k = lobeAt(hemis.l.geometry, e); if (k) onPick(k); }} />

      {/* مخچه */}
      <mesh geometry={cereb} material={mats.cereb} position={CEREB_C}
        onPointerMove={(e) => { e.stopPropagation(); setHover(cerebKey(e)); document.body.style.cursor = "pointer"; }}
        onPointerOut={out} onClick={(e) => { e.stopPropagation(); onPick(cerebKey(e)); }} />
      {cut && (
        <mesh position={[CEREB_C[0], CEREB_C[1], -0.001]} scale={[0.37, 0.235, 1]} material={mats.cerebCap}><circleGeometry args={[1, 64]} /></mesh>
      )}

      {/* ساقه‌ی مغز و نخاع */}
      <mesh geometry={stem} material={mats.stem} onPointerMove={(e) => { e.stopPropagation(); setHover(partOfStem(e)); document.body.style.cursor = "pointer"; }} onPointerOut={out} onClick={(e) => { e.stopPropagation(); onPick(partOfStem(e)); }} />
      <mesh geometry={cordG.cord} material={mats.cord} onPointerOver={hov("cord")} onPointerOut={out} onClick={(e) => { e.stopPropagation(); onPick("cord"); }} />
      <mesh geometry={cordG.roots} material={mats.roots} onPointerOver={hov("cord")} onPointerOut={out} onClick={(e) => { e.stopPropagation(); onPick("cord"); }} />

    </>
  );
});

/** مغز سه‌بعدی: شکل‌های ۲ (مراکز عصبی)، ۳ (بخش‌های قشر مخ)، ۴ (مخچه) و ۶ (ساقه‌ی مغز) کتاب. */
export default function BrainExplorer() {
  const [view, setView] = useState<View>("centers");
  const [sel, setSel] = useState<Key | null>(null);
  const [hover, setHover] = useState<Key | null>(null);
  const [cutOn, setCutOn] = useState<boolean | null>(null);
  const [names, setNames] = useState(true);
  const bridge = useRef<Bridge>({ els: [], lines: [] });
  const cfg = VIEWS[view];
  const cut = cutOn ?? cfg.cut;
  const info = sel ? INFO[sel] : null;
  const pick = (k: Key) => setSel((s) => (s === k ? null : k));
  const go = (v: View) => { setView(v); setSel(null); setCutOn(null); };
  const tab = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm transition ${on ? "bg-sky-600 font-bold text-white" : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"}`;
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${on ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"}`;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <button key={v} className={tab(view === v)} aria-pressed={view === v} onClick={() => go(v)}>{VIEWS[v].tab}</button>
        ))}
      </div>
      <LazyCanvas
        label="مغز سه‌بعدی با بخش‌های مخ، مخچه، ساقه‌ی مغز و نخاع"
        camera={{ position: [0.2, 0.05, 5.4], fov: 36 }}
        className="h-[28rem] md:h-[36rem]"
        overlay={
          <>
            <div className="absolute start-2 top-2 flex gap-1.5" dir="rtl">
              <button onClick={() => setCutOn(!cut)} aria-pressed={cut} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${cut ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white/90 text-slate-700 hover:bg-white"}`}>
                <Scissors className="size-3.5" aria-hidden="true" /> برش از وسط
              </button>
              <button onClick={() => setNames((n) => !n)} aria-pressed={names} className={`rounded-lg border px-2.5 py-1.5 text-xs shadow-sm ${names ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white/90 text-slate-700 hover:bg-white"}`}>نام اجزا</button>
            </div>
            <p className="pointer-events-none absolute bottom-2 start-2 text-[11px] text-slate-500" dir="rtl">بکشید تا بچرخد · چرخ ماوس برای بزرگ‌نمایی</p>
            {names && (
              <>
                <svg className="pointer-events-none absolute inset-0 size-full" style={{ overflow: "visible" }} aria-hidden="true">
                  {cfg.labels.map((l, i) => <line key={view + l.text + i} ref={(n) => { bridge.current.lines[i] = n; }} stroke="#111827" strokeWidth="1" />)}
                </svg>
                {cfg.labels.map((l, i) => (
                  <button
                    key={view + l.text + i} ref={(n) => { bridge.current.els[i] = n; }} onClick={() => pick(l.key)}
                    className={`absolute left-0 top-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[13px] font-semibold sm:text-sm ${sel === l.key || hover === l.key ? "bg-sky-100 text-sky-900" : "bg-white/80 text-[#2a73c9]"}`}
                    style={{ direction: "rtl" }}
                  >{l.text}</button>
                ))}
              </>
            )}
          </>
        }
      >
        <Scene view={view} sel={sel} hover={hover} cut={cut} setHover={setHover} onPick={pick} bridge={bridge} />
      </LazyCanvas>
      <p className="text-center text-sm text-sky-700 dark:text-sky-300">{cfg.caption}</p>

      <div className="flex flex-wrap items-center gap-2">
        {cfg.chips.map((k) => (
          <button key={k} onClick={() => pick(k)} aria-pressed={sel === k} className={chip(sel === k)}>
            <span className="size-3 rounded-full" style={{ background: DOT[k] }} />
            {INFO[k].title}
          </button>
        ))}
      </div>

      <div className="min-h-[7rem] rounded-xl bg-white p-3 text-sm leading-7 dark:bg-slate-800" aria-live="polite">
        {info ? (
          <>
            <p className="mb-1 flex flex-wrap items-center gap-2 font-bold">
              {info.title}
              <span className="rounded px-2 py-0.5 text-xs text-slate-900" style={{ background: DOT[sel!] }}>{info.where}</span>
            </p>
            <p>{info.text}</p>
            {info.extra && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{info.extra}</p>}
          </>
        ) : (
          <p className="text-slate-600 dark:text-slate-300">{cfg.intro}</p>
        )}
      </div>
    </div>
  );
}
