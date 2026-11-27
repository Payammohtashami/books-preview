import * as THREE from "three";
import { capsule, ellip, sdfMesh, type Prim, type V3 } from "./sdf";
import { headPrims } from "./headGeo";

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export interface SeatedPose {
  hipT: V3; kneeT: V3; hipB: V3; kneeB: V3; ankleB: V3; pivotY: number; shinLen: number; shinA0: number;
}

/** اندازه و محل سر (نسبت به دستگاه مختصات مغز) */
export const HEAD_S = 0.118;
export const HEAD_O: V3 = [0.02, 1.45, 0];
/** نقطه‌ای در دستگاه محلی سر ← مختصات جهان */
export const HP = (x: number, y: number, z: number): V3 => [HEAD_O[0] + x * HEAD_S, HEAD_O[1] + y * HEAD_S, HEAD_O[2] + z * HEAD_S];

/** وضعیت استراحت بازوها: دست‌ها روی ران‌ها (دستگاه مختصات جهان) */
export const ARM_REST = {
  R: { sh: [-0.005, 1.12, 0.205] as V3, el: [0.03, 0.76, 0.235] as V3, wr: [0.26, 0.665, 0.085] as V3 },
  L: { sh: [-0.005, 1.12, -0.205] as V3, el: [0.03, 0.76, -0.235] as V3, wr: [0.25, 0.58, -0.165] as V3 },
};
export const HAND_LEN = 0.1;

const bone = (a: V3, b: V3) => { const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a)); return { len: d.length(), dir: d.normalize() }; };

/** تبدیل یک جزء SDF با مقیاس و انتقال */
function xform(p: Prim, s: number, o: V3): Prim {
  return {
    k: p.k * s,
    f: (x, y, z) => s * p.f((x - o[0]) / s, (y - o[1]) / s, (z - o[2]) / s),
    lo: [o[0] + p.lo[0] * s, o[1] + p.lo[1] * s, o[2] + p.lo[2] * s],
    hi: [o[0] + p.hi[0] * s, o[1] + p.hi[1] * s, o[2] + p.hi[2] * s],
  };
}

/** جعبه‌ی گرد جهت‌دار (در دستگاه محلی f، l، n) */
function rbox(c: THREE.Vector3, F: THREE.Vector3, Lx: THREE.Vector3, N: THREE.Vector3, he: V3, r: number, k: number): Prim {
  const R = Math.hypot(he[0], he[1], he[2]) + r;
  return {
    k,
    f: (x, y, z) => {
      const dx = x - c.x, dy = y - c.y, dz = z - c.z;
      const qx = Math.abs(dx * F.x + dy * F.y + dz * F.z) - he[0] + r;
      const qy = Math.abs(dx * Lx.x + dy * Lx.y + dz * Lx.z) - he[1] + r;
      const qz = Math.abs(dx * N.x + dy * N.y + dz * N.z) - he[2] + r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
    },
    lo: [c.x - R, c.y - R, c.z - R], hi: [c.x + R, c.y + R, c.z + R],
  };
}

/** قاب محلی دست در حالت استراحت: f رو به انگشتان، n پشت دست، l رو به شست */
export function handFrame(wr: V3, fdir: THREE.Vector3, side: 1 | -1, tilt = 0.35) {
  const F = new THREE.Vector3(fdir.x, fdir.y * tilt, fdir.z).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const N = up.clone().addScaledVector(F, -up.dot(F)).normalize();
  const Lx = new THREE.Vector3().crossVectors(N, F).normalize();
  if (Math.sign(Lx.z) !== -side) Lx.negate(); // شست رو به خط وسط بدن
  return { W: new THREE.Vector3(...wr), F, Lx, N };
}

/** دست واقع‌نما: مچ، کف دست، برجستگی شست، چهار انگشت سه‌بندی خمیده و شست */
function handPrims(wr: V3, fdir: THREE.Vector3, side: 1 | -1): Prim[] {
  const { W, F, Lx, N } = handFrame(wr, fdir, side);
  const at = (u: number, l: number, w = 0) => W.clone().addScaledVector(F, u).addScaledVector(Lx, l).addScaledVector(N, w);
  const A = (v: THREE.Vector3) => v.toArray() as V3;
  const P: Prim[] = [
    rbox(at(-0.012, 0, 0.001), F, Lx, N, [0.022, 0.024, 0.015], 0.013, 0.012),   // مچ
    rbox(at(0.045, 0.002, 0), F, Lx, N, [0.04, 0.037, 0.0125], 0.011, 0.016),    // کف دست
    capsule(A(at(0.012, 0.022, -0.006)), A(at(0.05, 0.03, -0.007)), 0.013, 0.011, 0.012), // برجستگی شست
    capsule(A(at(0.03, -0.028, -0.004)), A(at(0.07, -0.03, -0.004)), 0.011, 0.01, 0.012), // برجستگی کف (لبه)
  ];
  // انگشتان: [فاصله‌ی عرضی، طول بندها، شعاع پایه، پیش‌آمدگی پایه]
  const fingers: [number, number[], number, number][] = [
    [0.026, [0.038, 0.024, 0.019], 0.0084, 0.082],
    [0.0085, [0.042, 0.027, 0.02], 0.0088, 0.086],
    [-0.0095, [0.039, 0.025, 0.019], 0.0082, 0.083],
    [-0.0265, [0.03, 0.019, 0.017], 0.0072, 0.076],
  ];
  const bend = [0.28, 0.42, 0.32]; // خمیدگی آرام انگشتان روی ران
  for (const [l, segs, r0, u0] of fingers) {
    let p = at(u0, l, -0.001);
    let dir = F.clone().addScaledVector(Lx, l * 0.9).normalize();
    let ang = 0, r = r0;
    P.push(ellip(A(at(u0 - 0.004, l, 0.008)), [0.008, 0.008, 0.006], 0.008)); // بند انگشت (برجستگی پشت)
    segs.forEach((len, i) => {
      ang += bend[i];
      const d = dir.clone().multiplyScalar(Math.cos(ang)).addScaledVector(N, -Math.sin(ang));
      const q = p.clone().addScaledVector(d, len);
      const r1 = r * (i === 2 ? 0.78 : 0.9);
      P.push(capsule(A(p), A(q), r, r1, 0.004));
      p = q; r = r1;
    });
  }
  // شست: رو به جلو و کمی پایین، کنار انگشت اشاره
  const t0 = at(0.022, 0.034, -0.008);
  const t1 = t0.clone().addScaledVector(F, 0.026).addScaledVector(Lx, 0.018).addScaledVector(N, -0.006);
  const t2 = t1.clone().addScaledVector(F, 0.03).addScaledVector(Lx, 0.006).addScaledVector(N, -0.01);
  const t3 = t2.clone().addScaledVector(F, 0.024).addScaledVector(Lx, -0.002).addScaledVector(N, -0.012);
  P.push(capsule(A(t0), A(t1), 0.0125, 0.0105, 0.008), capsule(A(t1), A(t2), 0.0105, 0.0095, 0.004), capsule(A(t2), A(t3), 0.0095, 0.0075, 0.004));
  return P;
}

/** دو دست با وضوح بالا (مش جدا): دست راست روی استخوان ساعد (۳)، دست چپ روی تنه (۱) */
export function buildHands() {
  const parts: { pos: number[]; tris: number[]; bone: number }[] = [];
  for (const [A, side, bone] of [[ARM_REST.R, 1, 3], [ARM_REST.L, -1, 1]] as const) {
    const fd = new THREE.Vector3(...A.wr).sub(new THREE.Vector3(...A.el)).normalize();
    const pr = handPrims(A.wr, fd, side);
    const w = A.wr;
    const { pos, tris } = sdfMesh(pr, [w[0] - 0.07, w[0] + 0.2, w[1] - 0.13, w[1] + 0.07, w[2] - 0.15, w[2] + 0.15], 0.0032, 2);
    parts.push({ pos, tris, bone });
  }
  const nv = parts.reduce((a, p) => a + p.pos.length / 3, 0);
  const pos = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const idx: number[] = [];
  let off = 0;
  for (const p of parts) {
    pos.set(p.pos, off * 3);
    const n = p.pos.length / 3;
    for (let i = 0; i < n; i++) { si[(off + i) * 4] = p.bone; sw[(off + i) * 4] = 1; }
    for (const t of p.tris) idx.push(t + off);
    off += n;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  geo.computeVertexNormals();
  return geo;
}

/** سطح یک‌تکه‌ی بدن نشسته (SDF + Surface Nets) و وزن‌های اسکین برای ۵ استخوان: لگن، تنه، بازوی راست (بالا/ساعد)، ساق پای رویی */
export function buildSeatedSkin(P: SeatedPose) {
  const rot = (v: V3, a: number): V3 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
  const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const ankleT = add(P.kneeT, rot([0, -P.shinLen, 0], P.shinA0));
  const AR = ARM_REST.R, AL = ARM_REST.L;
  const fR = bone(AR.el, AR.wr), fL = bone(AL.el, AL.wr);

  const prims: Prim[] = [
    ...headPrims(false).map((p) => xform(p, HEAD_S, HEAD_O)),       // سر با نیمرخ واقعی
    capsule([-0.005, 1.15, 0], [0.012, 1.34, 0], 0.056, 0.05, 0.04), // گردن
    ellip([-0.012, 1.145, 0], [0.068, 0.056, 0.19], 0.05),             // ذوزنقه‌ای (خط شانه)
    capsule([-0.005, 0.92, 0], [-0.008, 1.07, 0], 0.098, 0.1, 0.05, 1.5), // سینه
    ellip([0.04, 1.0, 0.07], [0.05, 0.05, 0.075], 0.05),            // سینه‌ای راست
    ellip([0.04, 1.0, -0.07], [0.05, 0.05, 0.075], 0.05),           // سینه‌ای چپ
    capsule([0, 0.6, 0], [0, 0.8, 0], 0.092, 0.095, 0.06, 1.36),     // کمر باریک
    ellip([0, 0.52, 0], [0.13, 0.1, 0.165], 0.05),                  // لگن
    capsule(P.hipT, P.kneeT, 0.068, 0.052, 0.03),
    capsule(P.hipB, P.kneeB, 0.064, 0.05, 0.03),
    ellip(P.kneeT, [0.054, 0.054, 0.054], 0.02),
    ellip(P.kneeB, [0.052, 0.052, 0.052], 0.02),
    capsule(P.kneeT, ankleT, 0.05, 0.034, 0.012),
    ellip(ankleT, [0.036, 0.036, 0.036], 0.01),
    capsule(P.kneeB, P.ankleB, 0.05, 0.034, 0.012),
    ellip(P.ankleB, [0.036, 0.036, 0.036], 0.01),
    ellip([AR.sh[0], AR.sh[1] - 0.01, AR.sh[2] + 0.008], [0.056, 0.06, 0.05], 0.035), // دلتوئید
    ellip([AL.sh[0], AL.sh[1] - 0.01, AL.sh[2] - 0.008], [0.056, 0.06, 0.05], 0.035),
  ];
  for (const A of [AR, AL]) {
    prims.push(
      capsule(A.sh, A.el, 0.045, 0.034, 0.012),
      ellip(A.el, [0.034, 0.034, 0.034], 0.012),
      capsule(A.el, A.wr, 0.036, 0.022, 0.012),
    );
  }

  const { pos, tris } = sdfMesh(prims, [-0.3, 0.7, 0.02, 1.6, -0.31, 0.31], 0.0105, 3);
  const nv = pos.length / 3;

  // وزن‌های اسکین
  const segDist = (px: number, py: number, pz: number, pts: V3[]) => {
    let best = 1e9;
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1];
      const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
      const t = clamp(((px - a[0]) * abx + (py - a[1]) * aby + (pz - a[2]) * abz) / (abx * abx + aby * aby + abz * abz));
      const dx = px - a[0] - abx * t, dy = py - a[1] - aby * t, dz = pz - a[2] - abz * t;
      best = Math.min(best, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    return best;
  };
  const tipR = add(AR.wr, [fR.dir.x * 0.17, fR.dir.y * 0.17, fR.dir.z * 0.17]);
  const tipL = add(AL.wr, [fL.dir.x * 0.17, fL.dir.y * 0.17, fL.dir.z * 0.17]);
  const armR: V3[] = [AR.sh, AR.el, AR.wr, tipR];
  const armL: V3[] = [AL.sh, AL.el, AL.wr, tipL];
  const ax = new THREE.Vector3(...ankleT).sub(new THREE.Vector3(...P.kneeT));
  const shinLen = ax.length(); ax.normalize();
  const uR = bone(AR.sh, AR.el);
  const skinIndex = new Uint16Array(nv * 4), skinWeight = new Float32Array(nv * 4);
  for (let q = 0; q < nv; q++) {
    const x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2];
    // بازوی راست: فاصله از محور بازو و پیشروی روی آن
    const dA = segDist(x, y, z, armR);
    const rxs = x - AR.sh[0], rys = y - AR.sh[1], rzs = z - AR.sh[2];
    const tU = rxs * uR.dir.x + rys * uR.dir.y + rzs * uR.dir.z; // پیشروی روی بازو از شانه
    const wA = sm(0.0, 0.1, tU) * (1 - sm(0.052, 0.07, dA)) * (z > 0.08 ? 1 : 0);
    const wF = wA * sm(uR.len - 0.035, uR.len + 0.035, tU);       // ساعد و دست
    const wU = wA - wF;
    const rx = x - P.kneeT[0], ry = y - P.kneeT[1], rz = z - P.kneeT[2];
    const t = rx * ax.x + ry * ax.y + rz * ax.z;
    const px = rx - ax.x * t, py = ry - ax.y * t, pz = rz - ax.z * t;
    const wS = sm(-0.01, 0.08, t) * (1 - sm(0.058, 0.082, Math.sqrt(px * px + py * py + pz * pz))) * (t < shinLen + 0.1 ? 1 : 0);
    let ySp = sm(0.58, 0.8, y) * (1 - sm(0.16, 0.24, x) * (1 - sm(0.85, 0.95, y)));
    if (segDist(x, y, z, armL) < 0.07 && z < -0.08) ySp = 1; // بازوی چپ با تنه می‌رود
    const rest = clamp(1 - wA - wS);
    const armV = wA > 0.0001;
    // استخوان‌ها: ۰ لگن، ۱ تنه، ۲ بازو، ۳ ساعد، ۴ ساق
    skinIndex[q * 4] = 0; skinIndex[q * 4 + 1] = 1; skinIndex[q * 4 + 2] = armV ? 2 : 4; skinIndex[q * 4 + 3] = 3;
    skinWeight[q * 4] = rest * (1 - ySp); skinWeight[q * 4 + 1] = rest * ySp;
    skinWeight[q * 4 + 2] = armV ? wU : wS; skinWeight[q * 4 + 3] = armV ? wF : 0;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(tris), 1));
  geo.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));
  geo.computeVertexNormals();
  return geo;
}
