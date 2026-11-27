/**
 * ساخت رویه‌ای (procedural) اسکلت انسان با three.js؛ بدون هیچ فایل مدل بیرونی.
 * مختصات مثل body-model.ts است: x به چپِ بیمار، y بالا، z به جلو. قد کل حدود ۳٫۶ واحد (کف پا y = −۱٫۸).
 * هر جزء با همان شناسهٔ body-data.ts یک Group است. بخش‌های ریز (برجستگی‌ها، استخوان‌های کوچک) با
 * ماده‌ای جدا ساخته می‌شوند که شناسهٔ آن (در skeleton-landmarks.ts) را دارد؛ بیننده از روی ماده آن‌ها را می‌شناسد.
 */
// @ts-ignore -- نوع‌ها با نصب @types/three فعال می‌شوند
import * as THREE from 'three';

/** 'nerve' و ... رنگ‌های آماده؛ هر رنگ هگز (مثل '#E7A9A3') هم پذیرفته می‌شود */
export type MatKind = 'bone' | 'cart' | 'dark' | 'tooth' | 'seam' | 'nerve' | 'muscle' | 'tendon' | `#${string}`;
export type MatFactory = (id: string, kind: MatKind) => THREE.Material;

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** خمیدگی ستون مهره‌ها: z برحسب y */
const SPINE: Array<[number, number]> = [
  [1.42, -0.03], [1.3, -0.045], [1.17, -0.072], [0.9, -0.108], [0.66, -0.092], [0.5, -0.06], [0.3, -0.04], [0.14, -0.078], [-0.04, -0.1],
];
export function spineZ(y: number): number {
  if (y >= SPINE[0][0]) return SPINE[0][1];
  for (let i = 0; i + 1 < SPINE.length; i += 1) {
    const [y0, z0] = SPINE[i]; const [y1, z1] = SPINE[i + 1];
    if (y <= y0 && y >= y1) { const t = (y0 - y) / (y0 - y1); return lerp(z0, z1, (1 - Math.cos(PI * t)) / 2); }
  }
  return SPINE[SPINE.length - 1][1];
}

/** پروفایل شعاع از چند ایستگاه [t, r] با درون‌یابی نرم و سرِ گرد */
export function prof(stops: Array<[number, number]>, cap = 0.05): (t: number) => number {
  return (t: number) => {
    let r = stops[stops.length - 1][1];
    for (let i = 0; i + 1 < stops.length; i += 1) {
      if (t >= stops[i][0] && t <= stops[i + 1][0]) {
        const u = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0] || 1);
        r = lerp(stops[i][1], stops[i + 1][1], (1 - Math.cos(PI * u)) / 2);
        break;
      }
    }
    if (cap > 0) {
      if (t < cap) r *= Math.sqrt(Math.max(0, 1 - ((cap - t) / cap) ** 2));
      else if (t > 1 - cap) r *= Math.sqrt(Math.max(0, 1 - ((t - (1 - cap)) / cap) ** 2));
    }
    return Math.max(r, 0.0006);
  };
}

/** لولهٔ با شعاع متغیر روی یک منحنی */
export function taper(pts: THREE.Vector3[], radius: (t: number) => number, radial = 14): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const n = Math.max(6, Math.ceil(curve.getLength() / 0.018));
  const geo = new THREE.TubeGeometry(curve, n, 1, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3(); const v = new THREE.Vector3();
  for (let i = 0; i <= n; i += 1) {
    const r = radius(i / n);
    curve.getPointAt(i / n, c);
    for (let j = 0; j <= radial; j += 1) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return geo;
}

export type P3 = [number, number, number];
export const pv = (p: P3) => V(p[0], p[1], p[2]);

/** جابه‌جایی جانبی ران: سر استخوان ران از لگن دورتر و زانوها به هم نزدیک‌ترند (مثل بدن واقعی) */
export function legShear(y: number): number {
  if (y >= 0.05) return 0;
  if (y >= 0) return 0.07 * (1 - y / 0.05);
  if (y > -0.95) return 0.07 * (1 + y / 0.95) ** 1.5;
  return 0;
}
const sstep = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** پهن‌شدن ناحیهٔ لگن (ضریب روی x) */
export const pelvisWidth = (y: number): number => 1 + 0.32 * (sstep(-0.3, -0.02, y) * (1 - sstep(0.25, 0.5, y)));
/** لگن: پهن‌تر؛ ران: دور شدن سر استخوان از مرکز؛ برای اعصاب لگنی-رانی هر دو با هم */
export const hipWarp = (x: number, y: number, z: number): P3 => [x * 1.32, y, z];
export const legWarp = (x: number, y: number, z: number): P3 => [x + legShear(y), y, z];
export const hipLegWarp = (x: number, y: number, z: number): P3 => [x * pelvisWidth(y) + legShear(y), y, z];
export const chestWarp = (x: number, y: number, z: number): P3 => [x * 1.2, y, z];

/** تغییر شکل هندسهٔ زیرمجموعه: همهٔ مش‌ها به مختصات root برده و رأس‌ها با fn جابه‌جا می‌شوند */
export function bakeWarp(root: THREE.Group, fn: (x: number, y: number, z: number) => P3): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes: THREE.Mesh[] = [];
  root.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  meshes.forEach((m) => {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    const geo = m.geometry.clone();
    geo.applyMatrix4(rel);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) { const r = fn(pos.getX(i), pos.getY(i), pos.getZ(i)); pos.setXYZ(i, r[0], r[1], r[2]); }
    geo.computeVertexNormals();
    m.geometry = geo;
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix();
    root.add(m);
  });
  root.children.slice().forEach((c: THREE.Object3D) => { if (!(c as THREE.Mesh).isMesh) root.remove(c); });
}

/** تغییر شکل جمجمه روی کرهٔ واحد (پایین باریک‌تر، پس‌سری برآمده) */
function skullDeform(x: number, y: number, z: number): P3 {
  let nx = x; let nz = z;
  if (y < 0) { nx *= 1 + y * 0.18; nz *= 1 + y * 0.12; }
  if (nz < 0) nz *= 1.06;
  if (nz > 0 && y > -0.1) nz *= 0.97;
  if (nz > 0 && y < -0.05) { const t = Math.min(1, (-0.05 - y) / 0.45); nz *= 1 - 0.8 * (t * t * (3 - 2 * t)); }
  return [nx, y, nz];
}
const SKULL_C: P3 = [0, 1.63, -0.025];
const SKULL_R: P3 = [0.155, 0.15, 0.185];
const skullWorld = (x: number, y: number, z: number): THREE.Vector3 => {
  const [a, b, c] = skullDeform(x, y, z);
  return V(SKULL_C[0] + a * SKULL_R[0], SKULL_C[1] + b * SKULL_R[1], SKULL_C[2] + c * SKULL_R[2]);
};
type SkullRegion = 'frontal' | 'parietal' | 'temporal' | 'occipital';
function skullRegion(x: number, y: number, z: number): SkullRegion {
  if (z > 0.3 && y > -0.25) return 'frontal';
  if (z < -0.5) return 'occipital';
  if (Math.abs(x) > 0.45 && y < 0.15 && y > -0.95) return 'temporal';
  if (y <= -0.25) return z < 0 ? 'occipital' : 'temporal';
  return 'parietal';
}
/** کره‌ای که به چهار ناحیهٔ جمجمه تقسیم شده است */
function skullGeometries(): Record<SkullRegion, THREE.BufferGeometry> {
  const base = new THREE.SphereGeometry(1, 72, 44);
  base.setAttribute('orig', base.attributes.position.clone());
  const pos = base.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const [x, y, z] = skullDeform(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, x, y, z);
  }
  base.computeVertexNormals();
  const flat = base.toNonIndexed();
  const P = flat.attributes.position; const N = flat.attributes.normal; const U = flat.attributes.uv; const O = flat.attributes.orig;
  const buckets: Record<SkullRegion, number[]> = { frontal: [], parietal: [], temporal: [], occipital: [] };
  for (let t = 0; t < P.count; t += 3) {
    const cx = (O.getX(t) + O.getX(t + 1) + O.getX(t + 2)) / 3;
    const cy = (O.getY(t) + O.getY(t + 1) + O.getY(t + 2)) / 3;
    const cz = (O.getZ(t) + O.getZ(t + 1) + O.getZ(t + 2)) / 3;
    buckets[skullRegion(cx, cy, cz)].push(t);
  }
  const out = {} as Record<SkullRegion, THREE.BufferGeometry>;
  (Object.keys(buckets) as SkullRegion[]).forEach((key) => {
    const list = buckets[key];
    const p = new Float32Array(list.length * 9); const n = new Float32Array(list.length * 9); const uv = new Float32Array(list.length * 6);
    list.forEach((t, k) => {
      for (let v = 0; v < 3; v += 1) {
        p[k * 9 + v * 3] = P.getX(t + v); p[k * 9 + v * 3 + 1] = P.getY(t + v); p[k * 9 + v * 3 + 2] = P.getZ(t + v);
        n[k * 9 + v * 3] = N.getX(t + v); n[k * 9 + v * 3 + 1] = N.getY(t + v); n[k * 9 + v * 3 + 2] = N.getZ(t + v);
        uv[k * 6 + v * 2] = U.getX(t + v); uv[k * 6 + v * 2 + 1] = U.getY(t + v);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out[key] = g;
  });
  return out;
}

export function buildSkeleton(mats: MatFactory): Record<string, THREE.Group> {
  const out: Record<string, THREE.Group> = {};
  type Fill = (g: THREE.Group, m: (kind?: MatKind) => THREE.Material, L: (id: string, kind?: MatKind) => THREE.Material) => void;

  /** هر جزء: سازنده‌ای که به یک Group می‌افزاید. mirror=true یعنی طرف مقابل را هم می‌سازد */
  function part(id: string, mirror: boolean, fill: Fill, warp?: (x: number, y: number, z: number) => P3): void {
    const m = (kind: MatKind = 'bone') => mats(id, kind);
    const L = (lm: string, kind: MatKind = 'bone') => mats(lm, kind);
    const root = new THREE.Group();
    const right = new THREE.Group();
    fill(right, m, L);
    if (warp) bakeWarp(right, warp);
    root.add(right);
    if (mirror) {
      const left = new THREE.Group();
      left.scale.x = -1;
      left.userData.side = 'L';
      left.add(right.clone());
      root.add(left);
    }
    root.traverse((o: THREE.Object3D) => { o.userData.id = id; if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; } });
    out[id] = root;
  }

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(geo, mat);
  const ell = (g: THREE.Object3D, mat: THREE.Material, c: P3, r: P3, rot?: P3) => {
    const m = mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    m.position.set(c[0], c[1], c[2]); m.scale.set(r[0], r[1], r[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    g.add(m); return m;
  };
  const tube = (g: THREE.Object3D, mat: THREE.Material, pts: P3[], stops: Array<[number, number]>, cap = 0.05, radial = 12) => {
    const m = mesh(taper(pts.map(pv), prof(stops, cap), radial), mat);
    g.add(m); return m;
  };

  /* ───────── جمجمه ───────── */
  part('cranium', false, (g, m, L) => {
    const regions = skullGeometries();
    const ids: Record<SkullRegion, string> = { frontal: 'frontal-bone', parietal: 'parietal-bone', temporal: 'temporal-bone', occipital: 'occipital-bone' };
    (Object.keys(regions) as SkullRegion[]).forEach((key) => {
      const piece = mesh(regions[key], L(ids[key]));
      piece.position.set(SKULL_C[0], SKULL_C[1], SKULL_C[2]); piece.scale.set(SKULL_R[0], SKULL_R[1], SKULL_R[2]);
      g.add(piece);
    });
    // درزها: تاجی، سهمی، لامبدایی و فلس‌دار
    const seam = (pts: THREE.Vector3[]) => g.add(mesh(taper(pts, () => 0.0024, 6), L('cranial-sutures', 'seam')));
    const arc = (f: (t: number) => P3, a: number, b: number, n = 26) => Array.from({ length: n + 1 }, (_, i) => { const p = f(lerp(a, b, i / n)); return skullWorld(p[0] * 1.004, p[1] * 1.004, p[2] * 1.004); });
    const R1 = Math.sqrt(1 - 0.3 * 0.3);
    seam(arc((t) => [Math.sin(t) * R1, Math.cos(t) * R1, 0.3], -1.25, 1.25));
    const R2 = Math.sqrt(1 - 0.5 * 0.5);
    seam(arc((t) => [Math.sin(t) * R2, Math.cos(t) * R2, -0.5], -1.15, 1.15));
    seam(arc((t) => [0, Math.cos(t), Math.sin(t)], -0.5236, 0.3047, 22));
    const R3 = Math.sqrt(1 - 0.15 * 0.15);
    for (const s of [1, -1]) seam(arc((t) => [s * Math.sqrt(Math.max(0, R3 * R3 - t * t)), 0.15, t], -0.46, 0.32, 14));
    // برجستگی ابرو و زائدهٔ پستانی
    tube(g, m(), [[-0.09, 1.625, 0.12], [-0.045, 1.632, 0.145], [0, 1.63, 0.15], [0.045, 1.632, 0.145], [0.09, 1.625, 0.12]], [[0, 0.013], [1, 0.013]], 0.08);
    for (const s of [1, -1]) ell(g, L('mastoid-process'), [0.074 * s, 1.5, -0.03], [0.014, 0.022, 0.018]);
  });

  part('facial-bones', false, (g, m, L) => {
    ell(g, L('maxilla'), [0, 1.497, 0.088], [0.07, 0.058, 0.056]);
    ell(g, L('maxilla'), [0, 1.462, 0.088], [0.05, 0.02, 0.048]);
    for (const s of [1, -1]) {
      ell(g, L('zygomatic-bone'), [0.098 * s, 1.545, 0.098], [0.024, 0.02, 0.022]);
      tube(g, L('zygomatic-bone'), [[0.098 * s, 1.543, 0.09], [0.12 * s, 1.55, 0.045], [0.117 * s, 1.545, -0.012]], [[0, 0.011], [1, 0.008]], 0.1);
      ell(g, L('orbit', '#3A2E25'), [0.058 * s, 1.578, 0.12], [0.026, 0.022, 0.02]);
      const rim = mesh(new THREE.TorusGeometry(0.03, 0.0062, 8, 24), L('orbit'));
      rim.position.set(0.058 * s, 1.578, 0.14); rim.scale.set(1, 0.88, 1); g.add(rim);
    }
    ell(g, L('nasal-bone'), [0, 1.592, 0.168], [0.013, 0.032, 0.01], [0.2, 0, 0]);
    ell(g, L('nasal-cavity', '#3A2E25'), [0, 1.528, 0.142], [0.013, 0.02, 0.012]);
    for (let i = 0; i < 14; i += 1) {
      const a = -PI * 0.5 + (i / 13) * PI;
      ell(g, L('upper-teeth', 'tooth'), [Math.sin(a) * 0.044, 1.45, 0.082 + Math.cos(a) * 0.042], [0.0095, 0.015, 0.0075], [0, a, 0]);
    }
    void m;
  });

  part('mandible', false, (g, m, L) => {
    for (const s of [1, -1]) {
      tube(g, L('mandibular-ramus'), [[0.1 * s, 1.47, 0.0], [0.088 * s, 1.397, 0.022], [0.058 * s, 1.376, 0.088], [0.012 * s, 1.372, 0.138]], [[0, 0.011], [0.3, 0.0125], [1, 0.0125]], 0.04);
      ell(g, L('mandibular-ramus'), [0.097 * s, 1.48, 0.008], [0.0065, 0.078, 0.03]);
      ell(g, L('mandibular-condyle'), [0.1 * s, 1.562, -0.004], [0.013, 0.01, 0.012]);
      ell(g, m(), [0.096 * s, 1.545, 0.032], [0.007, 0.024, 0.01]);
    }
    ell(g, L('mental-protuberance'), [0, 1.376, 0.136], [0.03, 0.02, 0.014]);
    ell(g, L('mandibular-ramus'), [0, 1.408, 0.086], [0.046, 0.02, 0.044]);
    for (let i = 0; i < 14; i += 1) {
      const a = -PI * 0.5 + (i / 13) * PI;
      ell(g, L('lower-teeth', 'tooth'), [Math.sin(a) * 0.04, 1.434, 0.082 + Math.cos(a) * 0.04], [0.009, 0.014, 0.007], [0, a, 0]);
    }
  });

  /* ───────── ستون مهره‌ها ───────── */
  interface ColTags { body?: string; spin?: string; trans?: string; disc: string; special?: (i: number) => string | undefined }
  function vertebra(g: THREE.Group, m: (k?: MatKind) => THREE.Material, L: (id: string, k?: MatKind) => THREE.Material, tags: ColTags, i: number, y: number, rb: number, h: number, spin: number, drop: number, tp: number, atlas: boolean) {
    const z = spineZ(y);
    const sp = tags.special?.(i);
    const own = sp ? L(sp) : null;
    if (atlas) {
      const mat = own ?? m();
      const ring = mesh(new THREE.TorusGeometry(0.028, 0.008, 10, 24), mat);
      ring.rotation.x = PI / 2; ring.position.set(0, y, z - 0.005); ring.scale.set(1.05, 1.15, 1);
      g.add(ring);
      ell(g, mat, [0.03, y, z], [0.013, 0.01, 0.014]); ell(g, mat, [-0.03, y, z], [0.013, 0.01, 0.014]);
      ell(g, mat, [0, y, z - 0.034], [0.008, 0.008, 0.008]);
      return;
    }
    const bodyMat = own ?? (tags.body ? L(tags.body) : m());
    const spinMat = own ?? (tags.spin ? L(tags.spin) : m());
    const transMat = own ?? (tags.trans ? L(tags.trans) : m());
    const body = mesh(new THREE.CylinderGeometry(rb, rb * 1.04, h, 24), bodyMat);
    body.scale.z = 0.82; body.position.set(0, y, z); g.add(body);
    const arch = mesh(new THREE.TorusGeometry(rb * 0.74, rb * 0.17, 8, 18, PI), m());
    arch.rotation.x = -PI / 2; arch.position.set(0, y, z - rb * 0.55); g.add(arch);
    for (const s of [1, -1]) ell(g, m(), [s * rb * 0.62, y + h * 0.55, z - rb * 0.95], [rb * 0.2, rb * 0.28, rb * 0.2]);
    const long = sp === 'c7' ? 1.9 : 1;
    tube(g, spinMat, [[0, y + 0.002, z - rb * 1.25], [0, y - drop * 0.5, z - rb * 1.25 - spin * 0.6 * long], [0, y - drop, z - rb * 1.25 - spin * long]], [[0, rb * 0.3], [1, rb * 0.17]], 0.1, 8);
    for (const s of [1, -1]) tube(g, transMat, [[s * rb * 0.8, y, z - rb * 0.95], [s * (rb + tp * 0.5), y + 0.002, z - rb * 1.05], [s * (rb + tp), y + 0.004, z - rb * 1.1]], [[0, rb * 0.2], [1, rb * 0.12]], 0.15, 8);
    if (sp === 'axis') ell(g, own as THREE.Material, [0, y + 0.024, z + 0.002], [0.0075, 0.02, 0.0075]);
  }
  function column(id: string, y0: number, y1: number, n: number, rb: number, h: number, spin: number, drop: number, tp: number, tags: ColTags, atlasFirst = false) {
    part(id, false, (g, m, L) => {
      for (let i = 0; i < n; i += 1) {
        const y = lerp(y0, y1, n === 1 ? 0 : i / (n - 1));
        const grow = 1 + (n > 1 ? (i / (n - 1)) * 0.22 : 0);
        vertebra(g, m, L, tags, i, y, rb * grow, h, spin, drop, tp, atlasFirst && i === 0);
        if (i < n - 1) {
          const yd = (y + lerp(y0, y1, (i + 1) / (n - 1))) / 2;
          const disc = mesh(new THREE.CylinderGeometry(rb * grow, rb * grow, Math.abs(y1 - y0) / (n - 1) * 0.28, 24), L(tags.disc, 'cart'));
          disc.scale.z = 0.82; disc.position.set(0, yd, spineZ(yd)); g.add(disc);
        }
      }
    });
  }
  column('cervical', 1.375, 1.205, 7, 0.02, 0.022, 0.03, 0.006, 0.03, { disc: 'disc-cervical', special: (i) => (i === 0 ? 'atlas' : i === 1 ? 'axis' : i === 6 ? 'c7' : undefined) }, true);
  column('thoracic', 1.15, 0.62, 12, 0.03, 0.036, 0.07, 0.04, 0.05, { disc: 'disc-thoracic', body: 'thoracic-body', spin: 'thoracic-spinous', trans: 'thoracic-transverse' });
  column('lumbar', 0.555, 0.265, 5, 0.044, 0.05, 0.05, 0.005, 0.065, { disc: 'disc-lumbar', body: 'lumbar-body' });

  part('sacrum', false, (g, m, L) => {
    const z0 = spineZ(0.245);
    const curve = new THREE.CatmullRomCurve3([V(0, 0.245, 0), V(0, 0.12, -0.11), V(0, -0.05, -0.05)]);
    const rad = prof([[0, 0.1], [0.5, 0.07], [1, 0.012]], 0.03);
    const s = mesh(taper(curve.getPoints(10), rad, 20), m());
    s.scale.z = 0.5; s.position.set(0, 0, z0); g.add(s);
    for (const t of [0.22, 0.38, 0.54, 0.7]) {
      const p = curve.getPointAt(t); const r = rad(t);
      for (const sx of [1, -1]) ell(g, L('sacral-foramina', '#4A3D31'), [sx * r * 0.52, p.y, z0 + p.z * 0.5 + r * 0.5 * 0.9], [0.0075, 0.0075, 0.005]);
    }
    tube(g, L('coccyx'), [[0, -0.05, z0 - 0.07], [0, -0.085, z0 - 0.06], [0, -0.115, z0 - 0.035]], [[0, 0.014], [1, 0.005]], 0.1, 10);
  });

  /* ───────── جناغ و دنده‌ها ───────── */
  const zst = (y: number) => 0.115 + (1.12 - y) * 0.11;
  part('sternum', false, (g, m, L) => {
    ell(g, L('manubrium'), [0, 1.082, zst(1.082)], [0.055, 0.04, 0.014], [0.2, 0, 0]);
    ell(g, L('sternal-body'), [0, 0.905, zst(0.905)], [0.03, 0.14, 0.013], [0.12, 0, 0]);
    ell(g, L('xiphoid-process'), [0, 0.715, zst(0.715) + 0.004], [0.013, 0.034, 0.008], [0.2, 0, 0]);
    void m;
  });

  const RA = [0.095, 0.13, 0.16, 0.18, 0.195, 0.205, 0.21, 0.215, 0.215, 0.21, 0.195, 0.18];
  const RB = [0.07, 0.09, 0.105, 0.115, 0.125, 0.13, 0.135, 0.135, 0.13, 0.12, 0.1, 0.08];
  const RD = [0.1, 0.09, 0.085, 0.09, 0.1, 0.11, 0.12, 0.13, 0.135, 0.13, 0.1, 0.07];
  const RE = [0.78, 0.78, 0.78, 0.78, 0.78, 0.78, 0.78, 0.8, 0.82, 0.82, 0.46, 0.4];
  const YS = [1.085, 1.03, 0.975, 0.915, 0.855, 0.8, 0.75];
  const ribY = (k: number) => 1.15 - 0.048 * k;
  function ribPt(k: number, phi: number): THREE.Vector3 {
    const yk = ribY(k); const zc = spineZ(yk) - 0.02 + RB[k]; const x0 = 0.04;
    return V(x0 + (RA[k] - x0) * Math.sin(phi), yk - RD[k] * (phi / PI) ** 1.3, zc - RB[k] * Math.cos(phi));
  }
  const ribCurve = (k: number) => {
    const pts: THREE.Vector3[] = [];
    const end = RE[k] * PI;
    for (let i = 0; i <= 14; i += 1) pts.push(ribPt(k, 0.05 * PI + ((end - 0.05 * PI) * i) / 14));
    return pts;
  };
  const rib = (g: THREE.Group, mat: THREE.Material, head: THREE.Material, k: number) => {
    const w = 0.0105 + 0.0008 * (k < 6 ? k : 6 - k * 0.2);
    const geo = taper(ribCurve(k), prof([[0, 0.012], [0.12, w], [0.8, w * 0.95], [1, w * 0.8]], 0.03), 10);
    g.add(mesh(geo, mat));
    ell(g, head, [ribPt(k, 0.05 * PI).x, ribY(k), spineZ(ribY(k)) - 0.02], [0.013, 0.012, 0.014]);
  };
  part('ribs-true', true, (g, m, L) => {
    for (let k = 0; k < 7; k += 1) rib(g, k === 0 ? L('first-rib') : m(), L('rib-head'), k);
  }, chestWarp);
  part('ribs-false', true, (g, m) => { for (let k = 7; k < 10; k += 1) rib(g, m(), m(), k); }, chestWarp);
  part('ribs-floating', true, (g, m) => { for (let k = 10; k < 12; k += 1) rib(g, m(), m(), k); }, chestWarp);

  part('costal-cartilage', true, (g, m) => {
    const curves: THREE.CatmullRomCurve3[] = [];
    for (let k = 0; k < 10; k += 1) {
      const start = ribPt(k, RE[k] * PI);
      let end: THREE.Vector3;
      if (k < 7) end = V(0.032, YS[k], zst(YS[k]) - 0.004);
      else end = curves[k - 1].getPoint(0.78);
      const mid = start.clone().lerp(end, 0.5); mid.y += k < 7 ? 0.012 : 0.03;
      const c = new THREE.CatmullRomCurve3([start, mid, end]);
      curves.push(c);
      g.add(mesh(taper(c.getPoints(10), prof([[0, 0.0095], [1, 0.0085]], 0.05), 10), m('cart')));
    }
  }, chestWarp);

  /* ───────── کمربند شانه و دست ───────── */
  part('clavicle', true, (g, m, L) => {
    tube(g, m(), [[0.022, 1.12, 0.124], [0.075, 1.136, 0.138], [0.15, 1.142, 0.12], [0.235, 1.134, 0.082], [0.325, 1.122, 0.03]], [[0, 0.016], [0.25, 0.011], [0.7, 0.009], [1, 0.011]], 0.06);
    ell(g, L('clavicle-sternal-end'), [0.026, 1.12, 0.124], [0.02, 0.018, 0.02]);
    ell(g, L('clavicle-acromial-end'), [0.322, 1.123, 0.032], [0.016, 0.01, 0.02], [0, 0.5, 0]);
  });

  part('scapula', true, (g, m, L) => {
    const plate = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0.0, 0.08); shape.quadraticCurveTo(0.02, 0.1, 0.07, 0.07);
    shape.lineTo(0.2, 0.0); shape.quadraticCurveTo(0.24, -0.03, 0.2, -0.07);
    shape.quadraticCurveTo(0.12, -0.12, 0.03, -0.22);
    shape.quadraticCurveTo(0.0, -0.25, -0.02, -0.2); shape.quadraticCurveTo(-0.03, -0.05, 0.0, 0.08);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 14 });
    plate.add(mesh(geo, m()));
    tube(plate, L('scapular-spine'), [[0.02, 0.0, -0.01], [0.12, 0.012, -0.022], [0.21, 0.016, -0.012]], [[0, 0.006], [0.6, 0.012], [1, 0.013]], 0.04, 8);
    ell(plate, L('acromion'), [0.255, 0.014, 0.012], [0.034, 0.011, 0.02], [0, -0.35, 0]);
    tube(plate, L('coracoid-process'), [[0.2, 0.0, 0.01], [0.255, -0.01, 0.06], [0.27, -0.015, 0.09]], [[0, 0.012], [1, 0.008]], 0.1, 8);
    ell(plate, L('glenoid-cavity'), [0.225, -0.035, 0.02], [0.02, 0.034, 0.014]);
    plate.position.set(0.085, 1.075, -0.152);
    plate.rotation.y = -0.5;
    plate.rotation.x = -0.12;
    g.add(plate);
  });

  part('humerus', true, (g, m, L) => {
    ell(g, L('humeral-head'), [0.34, 1.048, -0.006], [0.047, 0.05, 0.047]);
    ell(g, L('greater-tubercle'), [0.385, 1.058, 0.004], [0.022, 0.03, 0.022]);
    ell(g, L('lesser-tubercle'), [0.352, 1.052, 0.038], [0.015, 0.022, 0.015]);
    tube(g, L('humeral-shaft'), [[0.345, 1.02, 0.0], [0.385, 0.85, 0.003], [0.425, 0.62, 0.0], [0.444, 0.44, 0.0]], [[0, 0.028], [0.1, 0.024], [0.55, 0.02], [0.9, 0.024], [1, 0.032]], 0.03);
    ell(g, m(), [0.442, 0.405, 0.0], [0.034, 0.024, 0.03]);
    ell(g, L('trochlea'), [0.43, 0.378, 0.014], [0.02, 0.02, 0.022]);
    ell(g, L('capitulum'), [0.466, 0.382, 0.018], [0.018, 0.018, 0.018]);
    ell(g, L('medial-epicondyle'), [0.398, 0.41, -0.008], [0.014, 0.016, 0.014]);
    ell(g, L('lateral-epicondyle'), [0.49, 0.41, -0.006], [0.013, 0.015, 0.013]);
  });
  part('ulna', true, (g, m, L) => {
    ell(g, L('olecranon'), [0.435, 0.405, -0.034], [0.02, 0.026, 0.02]);
    tube(g, m(), [[0.436, 0.39, -0.022], [0.452, 0.22, -0.016], [0.488, 0.0, -0.01], [0.512, -0.105, -0.006]], [[0, 0.018], [0.15, 0.015], [0.8, 0.0095], [1, 0.012]], 0.04);
    ell(g, L('ulnar-styloid'), [0.516, -0.112, -0.006], [0.013, 0.015, 0.013]);
  });
  part('radius', true, (g, m, L) => {
    ell(g, L('radial-head'), [0.462, 0.378, 0.016], [0.017, 0.007, 0.017]);
    tube(g, m(), [[0.462, 0.37, 0.016], [0.484, 0.2, 0.034], [0.518, 0.0, 0.032], [0.538, -0.1, 0.022]], [[0, 0.011], [0.2, 0.012], [0.7, 0.014], [1, 0.02]], 0.04);
    ell(g, L('radial-styloid'), [0.55, -0.108, 0.016], [0.014, 0.014, 0.014]);
  });

  /* دست؛ مچ در (۰٫۵۲۵، −۰٫۱۲۵) و کف رو به جلو، شست به‌سمت بیرون (x مثبت) */
  const WX = 0.527; const WZ = 0.01;
  part('carpals', true, (g, m, L) => {
    ell(g, L('scaphoid'), [WX + 0.024, -0.134, WZ + 0.002], [0.013, 0.011, 0.01], [0, 0, -0.5]);
    ell(g, L('lunate'), [WX + 0.007, -0.13, WZ], [0.011, 0.01, 0.01]);
    ell(g, L('triquetrum'), [WX - 0.011, -0.134, WZ], [0.01, 0.009, 0.01]);
    ell(g, L('pisiform'), [WX - 0.014, -0.146, WZ + 0.013], [0.006, 0.006, 0.006]);
    ell(g, L('trapezium'), [WX + 0.029, -0.158, WZ + 0.005], [0.011, 0.01, 0.01]);
    ell(g, L('trapezoid'), [WX + 0.011, -0.158, WZ], [0.009, 0.009, 0.009]);
    ell(g, L('capitate'), [WX - 0.006, -0.156, WZ], [0.011, 0.013, 0.01]);
    ell(g, L('hamate'), [WX - 0.025, -0.158, WZ], [0.011, 0.011, 0.01]);
    void m;
  });
  const FINGERS = [
    { dx: 0.028, len: [0.04, 0.024, 0.02], meta: 0.115, tilt: 0.05, r: 0.0085 },
    { dx: 0.009, len: [0.045, 0.028, 0.021], meta: 0.12, tilt: 0.0, r: 0.0088 },
    { dx: -0.01, len: [0.042, 0.026, 0.02], meta: 0.11, tilt: -0.03, r: 0.0085 },
    { dx: -0.028, len: [0.033, 0.019, 0.017], meta: 0.1, tilt: -0.07, r: 0.0078 },
  ];
  part('metacarpals', true, (g, m) => {
    FINGERS.forEach((f) => {
      const x0 = WX + f.dx * 0.9; const y0 = -0.168;
      const x1 = WX + f.dx + f.tilt * f.meta; const y1 = y0 - f.meta;
      tube(g, m(), [[x0, y0, WZ], [(x0 + x1) / 2, (y0 + y1) / 2, WZ + 0.002], [x1, y1, WZ]], [[0, f.r * 1.25], [0.5, f.r * 0.85], [1, f.r * 1.2]], 0.08, 8);
    });
    tube(g, m(), [[WX + 0.025, -0.155, WZ + 0.012], [WX + 0.045, -0.2, WZ + 0.026], [WX + 0.062, -0.235, WZ + 0.03]], [[0, 0.011], [0.5, 0.008], [1, 0.0105]], 0.08, 8);
  });
  part('phalanges', true, (g, m) => {
    FINGERS.forEach((f) => {
      let x = WX + f.dx + f.tilt * f.meta; let y = -0.168 - f.meta - 0.003;
      f.len.forEach((l, i) => {
        const x2 = x + f.tilt * l; const y2 = y - l;
        tube(g, m(), [[x, y, WZ], [(x + x2) / 2, (y + y2) / 2, WZ], [x2, y2, WZ]], [[0, f.r * 1.1], [0.5, f.r * (0.8 - i * 0.07)], [1, f.r * 0.95]], 0.12, 8);
        x = x2; y = y2 - 0.003;
      });
    });
    let tx = WX + 0.062; let ty = -0.235; let tz = WZ + 0.03;
    [0.034, 0.026].forEach((l, i) => {
      const x2 = tx + 0.012; const y2 = ty - l;
      tube(g, m(), [[tx, ty, tz], [(tx + x2) / 2, (ty + y2) / 2, tz + 0.002], [x2, y2, tz + 0.004]], [[0, 0.0105], [0.5, 0.0085 - i * 0.001], [1, 0.01]], 0.12, 8);
      tx = x2; ty = y2 - 0.003; tz += 0.004;
    });
  });

  /* ───────── لگن و پا ───────── */
  part('hip-bone', true, (g, _m, L) => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.115, 0.02); sh.quadraticCurveTo(-0.115, 0.1, -0.06, 0.125);
    sh.quadraticCurveTo(0.02, 0.145, 0.085, 0.115); sh.quadraticCurveTo(0.125, 0.09, 0.12, 0.05);
    sh.lineTo(0.1, -0.015); sh.quadraticCurveTo(0.08, -0.07, 0.05, -0.11); sh.lineTo(0.04, -0.18);
    sh.lineTo(-0.015, -0.18); sh.quadraticCurveTo(-0.02, -0.07, -0.065, -0.045);
    sh.quadraticCurveTo(-0.11, -0.03, -0.115, 0.02);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 16 });
    const holder = new THREE.Group();
    holder.add(mesh(geo, L('ilium')));
    tube(holder, L('iliac-crest'), [[-0.113, 0.03, 0.007], [-0.095, 0.105, 0.007], [-0.02, 0.138, 0.007], [0.06, 0.128, 0.007], [0.112, 0.08, 0.007]], [[0, 0.009], [0.5, 0.011], [1, 0.009]], 0.05, 8);
    ell(holder, L('asis'), [0.118, 0.065, 0.007], [0.014, 0.016, 0.013]);
    holder.rotation.y = -Math.PI / 2 + 0.5;
    holder.position.set(0.122, 0.17, -0.003);
    g.add(holder);
    const aceta = mesh(new THREE.TorusGeometry(0.05, 0.014, 10, 24), L('acetabulum'));
    aceta.rotation.y = PI / 2; aceta.position.set(0.14, -0.008, 0.034); g.add(aceta);
    // صفحهٔ ایسکیوم و شرمگاه با سوراخ سدادی (محور u از پشت‌وخارج تا جلوی‌ومیانی، v به بالا)
    const ip = new THREE.Shape();
    const outline: Array<[number, number]> = [[-0.05, 0.075], [0.0, 0.088], [0.04, 0.062], [0.093, 0.032], [0.1, -0.03], [0.076, -0.06], [0.03, -0.07], [0.0, -0.086], [-0.055, -0.096], [-0.094, -0.076], [-0.1, -0.04], [-0.072, -0.018], [-0.074, 0.02]];
    ip.moveTo(outline[0][0], outline[0][1]);
    for (let i = 1; i < outline.length; i += 1) ip.lineTo(outline[i][0], outline[i][1]);
    ip.closePath();
    const hole = new THREE.Path();
    hole.absellipse(0.034, -0.018, 0.028, 0.022, 0, PI * 2, true, 0);
    ip.holes.push(hole);
    const ipGeo = new THREE.ExtrudeGeometry(ip, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 18 });
    ipGeo.translate(0, 0, -0.008);
    const plate = mesh(ipGeo, L('ischium'));
    plate.rotation.y = -2.08; plate.position.set(0.088, -0.056, 0.016);
    g.add(plate);
    tube(g, L('pubis'), [[0.064, 0.0, 0.02], [0.04, -0.012, 0.062], [0.017, -0.03, 0.1]], [[0, 0.0105], [1, 0.0115]], 0.1, 10);
    ell(g, L('ischial-tuberosity'), [0.099, -0.136, -0.046], [0.02, 0.016, 0.02]);
    ell(g, L('pubic-symphysis'), [0.015, -0.05, 0.102], [0.013, 0.025, 0.009]);
  }, hipWarp);

  part('femur', true, (g, m, L) => {
    ell(g, L('femoral-head'), [0.115, -0.006, 0.032], [0.048, 0.048, 0.048]);
    tube(g, L('femoral-neck'), [[0.11, -0.006, 0.03], [0.14, -0.045, 0.024], [0.176, -0.085, 0.018]], [[0, 0.03], [1, 0.034]], 0.03, 12);
    ell(g, L('greater-trochanter'), [0.188, -0.07, 0.005], [0.03, 0.036, 0.034]);
    ell(g, L('lesser-trochanter'), [0.15, -0.135, -0.012], [0.014, 0.02, 0.014]);
    tube(g, L('femoral-shaft'), [[0.176, -0.1, 0.02], [0.172, -0.35, 0.04], [0.164, -0.65, 0.036], [0.156, -0.9, 0.018]], [[0, 0.034], [0.15, 0.029], [0.55, 0.027], [0.9, 0.034], [1, 0.044]], 0.02, 14);
    ell(g, L('femoral-medial-condyle'), [0.13, -0.946, -0.01], [0.034, 0.038, 0.04]);
    ell(g, L('femoral-lateral-condyle'), [0.185, -0.946, -0.01], [0.034, 0.038, 0.04]);
    void m;
  }, legWarp);
  part('patella', true, (g, m) => { ell(g, m(), [0.158, -0.965, 0.062], [0.027, 0.03, 0.014], [0.1, 0, 0]); });
  part('tibia', true, (g, m, L) => {
    ell(g, L('tibial-plateau'), [0.157, -0.99, 0.002], [0.062, 0.014, 0.046]);
    tube(g, L('tibial-shaft'), [[0.157, -1.0, 0.012], [0.154, -1.25, 0.012], [0.15, -1.55, 0.004], [0.148, -1.72, 0.0]], [[0, 0.036], [0.15, 0.026], [0.6, 0.02], [0.95, 0.027], [1, 0.03]], 0.02, 12);
    ell(g, L('tibial-tuberosity'), [0.158, -1.065, 0.045], [0.012, 0.022, 0.012]);
    ell(g, L('medial-malleolus'), [0.126, -1.735, 0.0], [0.014, 0.022, 0.02]);
    void m;
  });
  part('fibula', true, (g, m, L) => {
    ell(g, L('fibular-head'), [0.212, -1.035, -0.018], [0.015, 0.016, 0.015]);
    tube(g, m(), [[0.212, -1.05, -0.016], [0.208, -1.3, -0.014], [0.2, -1.55, -0.012], [0.196, -1.725, -0.012]], [[0, 0.01], [0.3, 0.0078], [0.85, 0.0085], [1, 0.011]], 0.02, 8);
    ell(g, L('lateral-malleolus'), [0.195, -1.738, -0.012], [0.014, 0.024, 0.016]);
  });

  part('tarsals', true, (g, m, L) => {
    ell(g, L('calcaneus'), [0.158, -1.766, -0.062], [0.03, 0.034, 0.06], [0.25, 0, 0]);
    ell(g, L('talus'), [0.16, -1.74, -0.008], [0.033, 0.024, 0.036]);
    ell(g, L('navicular'), [0.135, -1.762, 0.046], [0.022, 0.018, 0.022]);
    ell(g, L('cuboid'), [0.195, -1.775, 0.04], [0.026, 0.02, 0.03]);
    [0.12, 0.15, 0.178].forEach((x) => ell(g, L('cuneiforms'), [x, -1.774, 0.082], [0.014, 0.014, 0.014]));
    void m;
  });
  const TOES = [
    { x: 0.126, z0: 0.1, len: 0.135, r: 0.0125, ph: [0.036, 0.03] },
    { x: 0.152, z0: 0.1, len: 0.13, r: 0.01, ph: [0.022, 0.014, 0.012] },
    { x: 0.176, z0: 0.098, len: 0.123, r: 0.0095, ph: [0.02, 0.013, 0.011] },
    { x: 0.198, z0: 0.094, len: 0.115, r: 0.009, ph: [0.018, 0.012, 0.01] },
    { x: 0.218, z0: 0.088, len: 0.105, r: 0.0085, ph: [0.015, 0.01, 0.009] },
  ];
  const FY = -1.787;
  part('metatarsals', true, (g, m) => {
    TOES.forEach((t, i) => {
      const x1 = t.x + (i - 1) * 0.004;
      tube(g, m(), [[t.x - 0.006, FY + 0.006, t.z0 - 0.01], [(t.x + x1) / 2, FY, t.z0 + t.len / 2], [x1, FY, t.z0 + t.len]], [[0, t.r * 1.2], [0.5, t.r * 0.8], [1, t.r * 1.2]], 0.08, 8);
    });
  });
  part('toe-bones', true, (g, m) => {
    TOES.forEach((t, i) => {
      let z = t.z0 + t.len + 0.003; const x = t.x + (i - 1) * 0.004;
      t.ph.forEach((l, k) => {
        tube(g, m(), [[x, FY, z], [x, FY - 0.001, z + l / 2], [x, FY - 0.002, z + l]], [[0, t.r * 1.05], [0.5, t.r * (0.75 - k * 0.05)], [1, t.r * 0.95]], 0.14, 8);
        z += l + 0.003;
      });
    });
  });

  return out;
}

/** سایهٔ نیمه‌شفاف بدن برای نشان دادن جای اسکلت */
export function buildSkin(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const ell = (c: P3, r: P3) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), mat); m.position.set(c[0], c[1], c[2]); m.scale.set(r[0], r[1], r[2]); g.add(m); };
  const limb = (pts: P3[], stops: Array<[number, number]>) => g.add(new THREE.Mesh(taper(pts.map(pv), prof(stops, 0.08), 18), mat));
  ell([0, 1.6, 0], [0.19, 0.24, 0.215]);
  limb([[0, 1.45, 0], [0, 1.25, -0.03]], [[0, 0.1], [1, 0.12]]);
  ell([0, 0.85, 0], [0.285, 0.5, 0.2]);
  ell([0, 0.2, -0.01], [0.27, 0.26, 0.19]);
  for (const s of [1, -1]) {
    ell([0.34 * s, 1.03, 0], [0.1, 0.1, 0.1]);
    limb([[0.37 * s, 1.0, 0], [0.45 * s, 0.4, 0], [0.54 * s, -0.12, 0.01]], [[0, 0.085], [0.5, 0.065], [1, 0.045]]);
    ell([0.57 * s, -0.27, 0.015], [0.045, 0.16, 0.025]);
    limb([[0.17 * s, -0.02, 0.02], [0.165 * s, -0.95, 0.03], [0.15 * s, -1.72, 0.0]], [[0, 0.145], [0.4, 0.11], [0.55, 0.085], [0.85, 0.06], [1, 0.05]]);
    ell([0.165 * s, -1.775, 0.05], [0.07, 0.03, 0.15]);
  }
  g.traverse((o: THREE.Object3D) => { (o as THREE.Mesh).castShadow = false; });
  return g;
}
