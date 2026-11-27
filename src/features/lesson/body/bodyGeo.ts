import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];

/** نقطه‌ی ستون مهره‌ها (u از ۰ در بالای گردن تا ۱ در استخوان خاجی؛ محور y بالا، بدن رو به +z) */
export const spineP = (u: number): V3 => [0, 1.38 - 1.68 * u, -0.1 + 0.05 * Math.cos(2 * Math.PI * (u + 0.05))];

export const tube = (points: V3[], r: number, seg = 24, radial = 5) =>
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, radial, false);

export const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list, false)!;

/** منحنی دنده‌ی شماره‌ی i در سمت side (۱ یا ‎−۱) */
export function ribPoints(i: number, side: number, n = 10): V3[] {
  const u = 0.12 + i * 0.04;
  const [, y, zs] = spineP(u);
  const w = 0.3 + 0.17 * Math.sin((Math.PI * (i + 1)) / (n + 1));
  const d = 0.27;
  return [
    [side * 0.03, y, zs],
    [side * w * 0.65, y - 0.03, zs + 0.02],
    [side * w, y - 0.09, zs + d * 0.45],
    [side * w * 0.8, y - 0.17, zs + d * 0.85],
    [side * w * 0.35, y - 0.24, zs + d * 1.05],
    [side * 0.04, y - 0.27, zs + d * 1.12],
  ];
}

/** کره‌ی ناهموار (برای چین‌خوردگی‌های مخ). classify اگر داده شود، به هر رأس شماره‌ی بخش می‌دهد. */
export function bumpy(rx: number, ry: number, rz: number, seed: number, amp: number, detail = 5, classify?: (p: THREE.Vector3) => number, freq = 5.5) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  const pos = g.attributes.position;
  const part: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const f = freq;
    const n =
      Math.abs(Math.sin(v.x * f + seed) * Math.cos(v.y * f * 1.2 + seed * 1.7)) +
      Math.abs(Math.sin(v.z * f * 1.1 + v.x * 2 + seed * 0.6)) * 0.7;
    const k = 1 + (n - 0.7) * amp;
    part.push(classify ? classify(v) : 0);
    pos.setXYZ(i, v.x * rx * k, v.y * ry * k, v.z * rz * k);
  }
  g.setAttribute("part", new THREE.Float32BufferAttribute(part, 1));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}
