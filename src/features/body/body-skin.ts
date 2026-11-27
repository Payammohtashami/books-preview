/**
 * پوست بدن در three.js: مش یک‌تکه از body-skin-sdf.ts (در Web Worker یا همین رشته) و ابزار لوفت
 * (مقطع‌های بیضوی-گوشه‌دار روی مسیر) که ماهیچه‌ها (muscles-3d.ts) از آن استفاده می‌کنند.
 * مختصات هم‌خوان با skeleton-3d.ts: x جانبی، y بالا، z جلو؛ قد ≈ ۳٫۶ و کف پا y = −۱٫۸.
 * نیمهٔ راست (x مثبت) ساخته و آینه می‌شود.
 */
// @ts-ignore -- نوع‌ها با نصب @types/three فعال می‌شوند
import * as THREE from 'three';
import { buildSkinArrays, type SkinArrays } from './body-skin-sdf';

const PI = Math.PI;

/** یک مقطع: مرکز + نیم‌قطر در جهت a (کناری) و b (عمود بر آن) + توان گوشه‌داری */
export interface Sec { c: THREE.Vector3; a: number; b: number; e: number }

const sgnPow = (v: number, p: number) => Math.sign(v) * Math.abs(v) ** p;

/** لوفت: بدنهٔ هموار با دو سر گرد. hint جهت مرجع محور a است */
export function loft(secs: Sec[], hint: THREE.Vector3, seg = 40, round = 4): THREE.BufferGeometry {
  const list = secs.slice();
  const cap = (sec: Sec, dir: THREE.Vector3, atEnd: boolean) => {
    const len = Math.min(sec.a, sec.b) * 0.95;
    const extra: Sec[] = [];
    for (let k = 1; k <= round; k += 1) {
      const ang = (k / round) * (PI / 2);
      const f = Math.max(Math.cos(ang), 0.02);
      extra.push({ c: sec.c.clone().addScaledVector(dir, len * Math.sin(ang)), a: sec.a * f, b: sec.b * f, e: sec.e });
    }
    if (atEnd) list.push(...extra); else list.unshift(...extra.reverse());
  };
  const n0 = list.length;
  const tStart = list[1].c.clone().sub(list[0].c).normalize();
  const tEnd = list[n0 - 1].c.clone().sub(list[n0 - 2].c).normalize();
  cap(list[0], tStart.clone().negate(), false);
  cap(list[list.length - 1], tEnd, true);

  const n = list.length;
  const pos: number[] = [];
  const idx: number[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < n; i += 1) {
    const T = (i === 0 ? list[1].c.clone().sub(list[0].c) : i === n - 1 ? list[n - 1].c.clone().sub(list[n - 2].c) : list[i + 1].c.clone().sub(list[i - 1].c)).normalize();
    const a = hint.clone().addScaledVector(T, -hint.dot(T));
    if (a.lengthSq() < 1e-6) a.set(0, 0, 1).addScaledVector(T, -T.z);
    a.normalize();
    const b = new THREE.Vector3().crossVectors(T, a).normalize();
    const s = list[i];
    for (let j = 0; j < seg; j += 1) {
      const th = (j / seg) * PI * 2;
      const p = 2 / s.e;
      tmp.copy(s.c).addScaledVector(a, s.a * sgnPow(Math.cos(th), p)).addScaledVector(b, s.b * sgnPow(Math.sin(th), p));
      pos.push(tmp.x, tmp.y, tmp.z);
    }
  }
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = 0; j < seg; j += 1) {
      const j2 = (j + 1) % seg;
      const a0 = i * seg + j; const a1 = i * seg + j2; const b0 = (i + 1) * seg + j; const b1 = (i + 1) * seg + j2;
      idx.push(a0, b0, a1, a1, b0, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // اگر جهت مثلث‌ها وارونه شد (نرمال به داخل)، برگردان
  const c = new THREE.Vector3(); const m = Math.floor(n / 2) * seg;
  const p0 = new THREE.Vector3(pos[m * 3], pos[m * 3 + 1], pos[m * 3 + 2]);
  const nr = new THREE.Vector3(g.attributes.normal.getX(m), g.attributes.normal.getY(m), g.attributes.normal.getZ(m));
  c.copy(list[Math.floor(n / 2)].c);
  if (nr.dot(p0.sub(c)) < 0) { g.setIndex(idx.map((_, k) => idx[k % 3 === 1 ? k + 1 : k % 3 === 2 ? k - 1 : k])); g.computeVertexNormals(); }
  return g;
}

export { TORSO } from './body-skin-sdf';

/** مش پوست از آرایه‌های رأس و اندیس */
export function skinMesh(arrays: SkinArrays, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arrays.pos, 3));
  geo.setIndex(new THREE.BufferAttribute(arrays.index, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 10;
  return mesh;
}

/** ساخت همزمان (برای آزمون یا وقتی Worker در دسترس نیست) */
export function buildBodySkin(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(skinMesh(buildSkinArrays(), mat));
  return g;
}
