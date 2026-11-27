import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ───────── نویز مقدار (value noise) سه‌بعدی ───────── */
function hash(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = (t: number) => t * t * (3 - 2 * t);
export function vnoise(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = fade(x - ix), fy = fade(y - iy), fz = fade(z - iz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), l(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
    l(l(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), l(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy),
    fz,
  );
}
const sstep = (a: number, b: number, x: number) => fade(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** فاصله‌ی نقطه تا پاره‌خط در صفحه */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/* ───────── مخ: لوب‌ها ───────── */
export type Lobe = 0 | 1 | 2 | 3; // پیشانی، آهیانه، پس‌سری، گیجگاهی
export const sylvY = (x: number) => -0.16 + (0.35 - x) * 0.3;
const centralX = (y: number) => 0.02 + (0.62 - y) * 0.45;
export function lobeOf(x: number, y: number): Lobe {
  if (x < -0.62) return 2;
  if (x < 0.58 && y < sylvY(x)) return 3;
  if (x > centralX(y)) return 0;
  return 1;
}

export interface CerebrumGeo {
  geometry: THREE.BufferGeometry;
  /** شاخص نخستین مثلث‌های سطح برش (برای نقاشی نقش درونی) */
  capStart: number;
  capCount: number;
}

const A = 1.0, B = 0.62, MED = 0.029, FLAT = -0.4;
const C0 = (0.83 - MED) / (1 - FLAT);

/** یک نیمکره‌ی مخ با چین‌خوردگی‌های واقع‌نمایانه. side: ‎+1 (z مثبت) یا ‎−1 */
export function buildHemisphere(side: 1 | -1, detail = 62): CerebrumGeo {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const pos = g.attributes.position;
  const n = pos.count;
  const part = new Float32Array(n);
  const cavity = new Float32Array(n);
  const cap = new Uint8Array(n);
  const seed = side > 0 ? 3.3 : 11.7;

  for (let i = 0; i < n; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const zl = Math.max(uz * side, FLAT); // لبه‌ی میانی تخت می‌شود
    const onCap = uz * side <= FLAT + 1e-6;
    // شکل پایه
    const front = Math.max(0, ux), back = Math.max(0, -ux);
    const c = C0 * (1 - 0.2 * front * front - 0.1 * back * back);
    let x = A * ux;
    let y = uy >= 0 ? B * uy : B * 0.74 * uy * (1 - 0.1 * (1 - Math.abs(ux)));
    y -= 0.07 * front * front;
    // برآمدگی‌ی گیجگاهی
    const tb = 0.24 * Math.exp(-(((ux - 0.28) ** 2) / 0.09 + ((uy + 0.62) ** 2) / 0.07));
    y -= tb * 0.55;
    const lat = Math.max(0, zl);
    let z = side * (MED + (zl - FLAT) * c + tb * 0.3 * lat);
    // ناهمواری سطح
    const lx = x, ly = y;
    const lobe = lobeOf(lx, ly);
    let valley = 0;
    let depth = 0;
    const w = sstep(FLAT + 0.04, FLAT + 0.45, zl); // روی سطح برش هیچ چین‌خوردگی‌ای نیست
    if (w > 0) {
      const f1 = 9.6;
      const px = lx * f1, py = ly * f1 * 1.05, pz = z * f1 + seed;
      const warp = (vnoise(px * 0.45 + 5, py * 0.45, pz * 0.45) - 0.5) * 1.4;
      const sm = (a: number, b: number, c: number) => 0.5 * (vnoise(a, b, c) + vnoise(0.72 * a + 0.69 * c + 13, b + 3, -0.69 * a + 0.72 * c + 7));
      const nn = 0.68 * sm(px + warp, py - warp, pz + warp * 0.6) + 0.26 * sm(px * 2.1 + seed, py * 2.1, pz * 2.1) + 0.06 * sm(px * 4.3, py * 4.3 + seed, pz * 4.3);
      const l = Math.abs(nn - 0.5) * 2;
      valley = Math.exp(-((l / 0.095) ** 2));
      // شیارهای اصلی: سیلویوس، مرکزی، آهیانه‌ـ پس‌سری
      const lateralOnly = sstep(0.0, 0.5, zl);
      const gS = Math.exp(-((segDist(lx, ly, 0.42, sylvY(0.42), -0.5, sylvY(-0.5)) / 0.028) ** 2)) * lateralOnly;
      const gC = Math.exp(-((segDist(lx, ly, 0.0, 0.64, 0.28, -0.04) / 0.022) ** 2)) * (0.4 + 0.6 * lateralOnly);
      const gP = Math.exp(-((segDist(lx, ly, -0.55, 0.6, -0.66, 0.0) / 0.024) ** 2)) * (0.5 + 0.5 * lateralOnly);
      const groove = Math.max(gS, gC * 0.85, gP * 0.9);
      valley = Math.max(valley, groove);
      depth = (-0.052 * valley - 0.05 * groove + 0.016 * (1 - valley)) * w;
    }
    // جابه‌جایی در راستای خارج
    let dx = ux, dy = uy, dz = zl;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    x += dx * depth * 1.0;
    y += dy * depth * 1.0;
    z += side * dz * depth * 1.0;
    pos.setXYZ(i, x, y, z);
    part[i] = lobe;
    cavity[i] = valley * w;
    cap[i] = onCap ? 1 : 0;
  }
  g.setAttribute("lobe", new THREE.BufferAttribute(part, 1));
  g.setAttribute("cavity", new THREE.BufferAttribute(cavity, 1));

  // جدا کردن مثلث‌های سطح برش
  const idx = g.index!.array as Uint32Array | Uint16Array;
  const lat: number[] = [], capTris: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    (cap[a] && cap[b] && cap[c] ? capTris : lat).push(a, b, c);
  }
  g.setIndex([...lat, ...capTris]);
  g.clearGroups();
  g.addGroup(0, lat.length, 0);
  g.addGroup(lat.length, capTris.length, 1);
  g.computeVertexNormals();
  // مختصات تصویر تخت برای سطح برش
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { uv[i * 2] = (pos.getX(i) + 1.05) / 2.1; uv[i * 2 + 1] = (pos.getY(i) + 0.62) / 1.3; }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return { geometry: g, capStart: lat.length, capCount: capTris.length };
}

/* ───────── مخچه ───────── */
export const CEREB_C: [number, number, number] = [-0.62, -0.56, 0];
const CEREB_R: [number, number, number] = [0.38, 0.24, 0.6];

export function buildCerebellum(detail = 44): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const pos = g.attributes.position;
  const part = new Float32Array(pos.count); // ۰ نیمکره، ۱ کرمینه
  const cavity = new Float32Array(pos.count);
  const N = 27;
  for (let i = 0; i < pos.count; i++) {
    let ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    // فرم: نیمکره‌های پهن، کمی فرو رفتگی در پایین/میانه
    uy *= uy < 0 ? 0.9 : 1;
    const phi = Math.atan2(uy * 1.4, ux) + (vnoise(ux * 3, uy * 3, uz * 3) - 0.5) * 0.18;
    const s = Math.abs(Math.sin(phi * N * 0.5 + uz * 0.35));
    const valley = 1 - sstep(0, 0.2, s);
    const az = Math.abs(uz);
    const vermis = Math.exp(-((uz / 0.14) ** 2));
    const sulc = Math.exp(-(((az - 0.24) / 0.05) ** 2));
    const d = -0.014 * valley + 0.03 * vermis - 0.03 * sulc;
    const dl = Math.hypot(ux, uy, uz) || 1;
    const k = 1 + d / 0.3;
    ux *= k; uy *= k; uz *= k;
    void dl;
    pos.setXYZ(i, ux * CEREB_R[0], uy * CEREB_R[1], uz * CEREB_R[2]);
    part[i] = az < 0.15 ? 1 : 0;
    cavity[i] = valley;
  }
  g.setAttribute("part", new THREE.BufferAttribute(part, 1));
  g.setAttribute("cavity", new THREE.BufferAttribute(cavity, 1));
  g.computeVertexNormals();
  return g;
}

/* ───────── لوله‌ای با شعاع متغیر (ساقه‌ی مغز و نخاع) ───────── */
export function loft(
  pts: [number, number][], radial: (s: number) => [number, number], segs = 90, around = 28,
  partOf: (s: number) => number = () => 0, shift: (s: number) => number = () => 0,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const pos: number[] = [], part: number[] = [], idx: number[] = [], sv: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    const p = curve.getPointAt(s), t = curve.getTangentAt(s);
    const nrm = new THREE.Vector3(t.y, -t.x, 0).normalize(); // سمت جلو
    const [rx, rz] = radial(s);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const o = shift(s);
      pos.push(p.x + nrm.x * (Math.cos(a) * rx + o), p.y + nrm.y * (Math.cos(a) * rx + o), Math.sin(a) * rz);
      part.push(partOf(s)); sv.push(s);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j, b = i * around + ((j + 1) % around), c = (i + 1) * around + j, d = (i + 1) * around + ((j + 1) % around);
      idx.push(a, c, b, b, c, d);
    }
  }
  // سرپوش‌ها
  const top = pos.length / 3; pos.push(...curve.getPointAt(0).toArray()); part.push(partOf(0)); sv.push(0);
  const bot = top + 1; pos.push(...curve.getPointAt(1).toArray()); part.push(partOf(1)); sv.push(1);
  for (let j = 0; j < around; j++) {
    idx.push(top, j, (j + 1) % around);
    idx.push(bot, segs * around + ((j + 1) % around), segs * around + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("part", new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute("s", new THREE.Float32BufferAttribute(sv, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const bell = (s: number, m: number, w: number) => Math.exp(-(((s - m) / w) ** 2));

/** ساقه‌ی مغز: مغز میانی، پل مغزی و بصل‌النخاع (part: ۰ تا ۲) */
export function buildStem(): THREE.BufferGeometry {
  const pts: [number, number][] = [[0.1, -0.16], [0.04, -0.45], [-0.03, -0.78], [-0.12, -1.1], [-0.2, -1.4]];
  return loft(
    pts,
    (s) => {
      const r = 0.1 + 0.1 * bell(s, 0.42, 0.15) - Math.max(0, s - 0.62) * 0.09;
      return [r * 1.05, r * 1.15];
    },
    80, 28,
    (s) => (s < 0.28 ? 0 : s < 0.6 ? 1 : 2),
    (s) => 0.03 * bell(s, 0.42, 0.16),
  );
}
export const STEM_END: [number, number] = [-0.2, -1.4];

/** نخاع + ریشه‌های عصبی */
export function buildCord(): { cord: THREE.BufferGeometry; roots: THREE.BufferGeometry } {
  const pts: [number, number][] = [[-0.2, -1.4], [-0.225, -1.95], [-0.21, -2.55], [-0.18, -3.2]];
  const cord = loft(pts, (s) => [0.066 - s * 0.012, 0.062 - s * 0.012], 90, 20);
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const list: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const s = 0.04 + (i / 14) * 0.94;
    const p = curve.getPointAt(s);
    for (const sd of [-1, 1]) {
      const r = new THREE.CatmullRomCurve3([
        new THREE.Vector3(p.x, p.y, sd * 0.05),
        new THREE.Vector3(p.x - 0.01, p.y - 0.03, sd * 0.16),
        new THREE.Vector3(p.x - 0.03, p.y - 0.13, sd * 0.3),
        new THREE.Vector3(p.x - 0.07, p.y - 0.3, sd * 0.4),
      ]);
      list.push(new THREE.TubeGeometry(r, 12, 0.011 - s * 0.003, 6, false));
    }
  }
  return { cord, roots: mergeGeometries(list, false)! };
}

/* ───────── سر (شکل ۲) ───────── */
export function buildHead(): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 30);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-5);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i), uy = pos.getY(i), uz = pos.getZ(i);
    const low = Math.max(0, -uy);
    let X = ux * 1.24;
    let Y = uy >= 0 ? uy * 1.04 : uy * (1.04 + 0.62 * low);
    let Z = uz * 0.94 * (1 - 0.46 * Math.pow(low, 1.3));
    if (ux > -0.2) X += 0.42 * low * (0.4 + ux * 0.6);   // صورت و چانه جلوتر
    else X *= 1 - 0.34 * low;                              // پشت سر تا گردن جمع می‌شود
    // بینی
    X += 0.2 * Math.exp(-(((ux - 0.86) ** 2) / 0.045 + ((uy + 0.18) ** 2) / 0.03 + (uz ** 2) / 0.02));
    pos.setXYZ(i, X + 0.04, Y - 0.1, Z);
  }
  g.computeVertexNormals();
  return g;
}

/* ───────── نقاشی سطح برش (نیمه‌ی میانی مغز) ───────── */
export function paintMedial(geo: THREE.BufferGeometry, capStart: number, capCount: number): THREE.CanvasTexture {
  const W = 1400, H = Math.round((W * 1.3) / 2.1);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const pos = geo.attributes.position;
  const idx = geo.index!.array;
  const px = (x: number) => ((x + 1.05) / 2.1) * W;
  const py = (y: number) => (1 - (y + 0.62) / 1.3) * H;
  const path = new Path2D();
  let cx = 0, cy = 0, cn = 0;
  for (let i = capStart; i < capStart + capCount; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = idx[i + k];
      const X = px(pos.getX(v)), Y = py(pos.getY(v));
      if (k === 0) path.moveTo(X, Y); else path.lineTo(X, Y);
      cx += X; cy += Y; cn++;
    }
    path.closePath();
  }
  cx /= cn; cy /= cn;
  // ماده‌ی خاکستری (قشر)
  g.fillStyle = "#d89f98"; g.fill(path);
  g.strokeStyle = "#d89f98"; g.lineWidth = 2.5; g.stroke(path);
  // ماده‌ی سفید
  g.save();
  g.translate(cx, cy); g.scale(0.92, 0.9); g.translate(-cx, -cy);
  g.fillStyle = "#f6eddc"; g.fill(path);
  g.restore();
  g.save();
  g.clip(path);
  const X = (x: number) => px(x), Y = (y: number) => py(y);
  // رباط پینه‌ای
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "#d2bf98"; g.lineWidth = 40;
  const cc = [[0.5, 0.02], [0.4, 0.17], [0.15, 0.25], [-0.2, 0.25], [-0.45, 0.16], [-0.58, 0.0]];
  const curve = (pts: number[][]) => { g.beginPath(); g.moveTo(X(pts[0][0]), Y(pts[0][1])); for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(X(pts[i][0]), Y(pts[i][1]), X(mx), Y(my)); } g.lineTo(X(pts[pts.length - 1][0]), Y(pts[pts.length - 1][1])); g.stroke(); };
  curve(cc);
  g.strokeStyle = "#fff8e8"; g.lineWidth = 31; curve(cc);
  // تالاموس
  g.fillStyle = "#e1b3a6"; g.beginPath(); g.ellipse(X(-0.02), Y(-0.1), 0.1 * W / 2.1, 0.075 * H / 1.3, 0.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#bf8a80"; g.lineWidth = 2.5; g.stroke();
  // فورنیکس
  g.strokeStyle = "#ecd9b0"; g.lineWidth = 7; curve([[0.35, 0.0], [0.2, 0.1], [-0.1, 0.1], [-0.3, -0.05], [-0.34, -0.2]]);
  // شیارهای قشری
  g.strokeStyle = "rgba(160,100,95,0.55)"; g.lineWidth = 2.5;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, r1 = 0.8 + 0.1 * Math.sin(i * 2.3);
    const x0 = Math.cos(a) * 1.02, y0 = Math.sin(a) * 0.62;
    g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x0 * (1 - 0.16 * r1)), Y(y0 * (1 - 0.16 * r1))); g.stroke();
  }
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** برش مخچه (درخت زندگی) */
export function paintCerebellumCut(): THREE.CanvasTexture {
  const S = 768;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const g = c.getContext("2d")!;
  const R = S / 2 - 4;
  g.translate(S / 2, S / 2);
  g.beginPath(); g.ellipse(0, 0, R, R, 0, 0, Math.PI * 2); g.fillStyle = "#d9a07f"; g.fill();
  g.beginPath(); g.ellipse(0, 0, R * 0.9, R * 0.9, 0, 0, Math.PI * 2); g.fillStyle = "#e9c3a1"; g.fill();
  g.lineCap = "round";
  const branch = (x: number, y: number, ang: number, len: number, w: number, depth: number) => {
    if (depth === 0 || len < 6) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    g.strokeStyle = "#fbf3e1"; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    branch(x2, y2, ang - 0.55, len * 0.7, w * 0.7, depth - 1);
    branch(x2, y2, ang + 0.55, len * 0.7, w * 0.7, depth - 1);
    branch(x2, y2, ang + 0.05, len * 0.62, w * 0.6, depth - 1);
  };
  g.save();
  g.beginPath(); g.arc(0, 0, R * 0.9, 0, Math.PI * 2); g.clip();
  g.fillStyle = "#fbf3e1"; g.beginPath(); g.arc(R * 0.0, R * 0.05, R * 0.14, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 7; i++) branch(0, R * 0.05, -Math.PI + 0.35 + (i / 6) * (Math.PI * 1.6 - 0.35 * 2) - 0.2, R * 0.34, R * 0.06, 4);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
