/**
 * ساخت رویه‌ای دستگاه عصبی با three.js؛ هم‌مختصات با skeleton-3d.ts (x به سمت راست‌ساخته‌شده، y بالا، z جلو).
 * مغز، مخچه، ساقه، نخاع، دم اسبی، گانگلیون‌ها و عصب‌های اصلی دست و پا مطابق چارت دستگاه عصبی.
 * مثل اسکلت، بخش‌های ریز با ماده‌ای جدا ساخته می‌شوند که شناسهٔ آن در nervous-landmarks.ts است.
 */
// @ts-ignore -- نوع‌ها با نصب @types/three فعال می‌شوند
import * as THREE from 'three';
import { bakeWarp, chestWarp, hipLegWarp, pelvisWidth, prof, pv, spineZ, taper, type MatFactory, type MatKind, type P3 } from './skeleton-3d';

const PI = Math.PI;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const BRAIN = '#E9ADA6';
const LOBE_F = '#EBA59B';
const LOBE_P = '#E8BC8E';
const LOBE_T = '#D9A5C2';
const LOBE_O = '#A9BFE0';
const CEREB = '#D99A8C';
const STEM = '#E8C27A';
const TOES_X = [0.126, 0.152, 0.176, 0.198, 0.218];
const CORD = '#F7EBB4';

/** مرکز مجرای مهره‌ها (مختصات z) */
const canalZ = (y: number): number => {
  const yy = Math.max(y, 0.265);
  return spineZ(yy) - 0.034 - Math.max(0, 0.265 - y) * 0.22;
};

/* دنده‌ها (همان پارامترهای skeleton-3d) برای مسیر عصب‌های بین‌دنده‌ای */
const RA = [0.095, 0.13, 0.16, 0.18, 0.195, 0.205, 0.21, 0.215, 0.215, 0.21, 0.195, 0.18];
const RB = [0.07, 0.09, 0.105, 0.115, 0.125, 0.13, 0.135, 0.135, 0.13, 0.12, 0.1, 0.08];
const RD = [0.1, 0.09, 0.085, 0.09, 0.1, 0.11, 0.12, 0.13, 0.135, 0.13, 0.1, 0.07];
const ribY = (k: number) => 1.15 - 0.048 * k;
function ribXYZ(k: number, phi: number, shrink = 1): THREE.Vector3 {
  const yk = ribY(k); const zc = spineZ(yk) - 0.02 + RB[k]; const x0 = 0.04;
  return V((x0 + (RA[k] - x0) * Math.sin(phi)) * shrink, yk - RD[k] * (phi / PI) ** 1.3, zc - RB[k] * Math.cos(phi));
}

/** شعاع نخاع در ارتفاع y (با برآمدگی‌های گردنی و کمری) */
const cordProf = prof([[0, 0.0095], [0.1, 0.0125], [0.2, 0.0138], [0.35, 0.0106], [0.65, 0.0095], [0.8, 0.0126], [0.88, 0.0126], [0.96, 0.0075], [1, 0.0016]], 0.01);
const CORD_TOP = 1.452; const CORD_BOT = 0.5;
const cordR = (y: number) => cordProf((CORD_TOP - y) / (CORD_TOP - CORD_BOT));

type Region = string;
/** تقسیم یک کره به چند ناحیه بر پایهٔ جهت مرکز هر مثلث (روی کرهٔ اولیه) */
function splitSphere(base: THREE.BufferGeometry, classify: (x: number, y: number, z: number) => Region): Record<string, THREE.BufferGeometry> {
  const flat = base.toNonIndexed();
  const P = flat.attributes.position; const N = flat.attributes.normal; const U = flat.attributes.uv; const O = flat.attributes.orig;
  const buckets: Record<string, number[]> = {};
  for (let t = 0; t < P.count; t += 3) {
    const cx = (O.getX(t) + O.getX(t + 1) + O.getX(t + 2)) / 3;
    const cy = (O.getY(t) + O.getY(t + 1) + O.getY(t + 2)) / 3;
    const cz = (O.getZ(t) + O.getZ(t + 1) + O.getZ(t + 2)) / 3;
    const key = classify(cx, cy, cz);
    (buckets[key] = buckets[key] ?? []).push(t);
  }
  const out: Record<string, THREE.BufferGeometry> = {};
  Object.keys(buckets).forEach((key) => {
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

/** چین‌خوردگی قشر مخ: جابه‌جایی شعاعی نرم روی کرهٔ واحد */
const gyri = (x: number, y: number, z: number): number =>
  1 + 0.03 * Math.sin(x * 12 + z * 8) * Math.sin(y * 10 - z * 9) + 0.022 * Math.sin(z * 19 + y * 6) * Math.cos(x * 14) + 0.012 * Math.sin(y * 31 + x * 17);

/** نیمکرهٔ مخ؛ مرکز و شعاع‌ها در تابع بیرونی اعمال می‌شود */
const HEMI_C: P3 = [0.075, 1.642, -0.02];
const HEMI_R: P3 = [0.072, 0.125, 0.165];
function hemisphereLobes(): Record<string, THREE.BufferGeometry> {
  const base = new THREE.SphereGeometry(1, 72, 52);
  base.setAttribute('orig', base.attributes.position.clone());
  const pos = base.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i); let y = pos.getY(i); const z = pos.getZ(i);
    const g = gyri(x, y, z);
    if (x < -0.7) x = -0.7 + (x + 0.7) * 0.12; // سطح میانی تقریباً تخت
    if (y < -0.4) y = -0.4 + (y + 0.4) * 0.5;
    pos.setXYZ(i, x * g, y * g, z * g);
  }
  base.computeVertexNormals();
  return splitSphere(base, (x, y, z) => {
    if (y < -0.2 && x > 0.15 && z > -0.55 && z < 0.6) return 'T';
    if (z > 0.28) return 'F';
    if (z < -0.5) return 'O';
    return 'P';
  });
}
const hemiWorld = (dx: number, dy: number, dz: number, k = 1.03): THREE.Vector3 => {
  const l = Math.hypot(dx, dy, dz) || 1;
  const x = dx / l; const y = dy / l; const z = dz / l;
  const g = gyri(x, y, z) * k;
  return V(HEMI_C[0] + x * g * HEMI_R[0], HEMI_C[1] + y * g * HEMI_R[1], HEMI_C[2] + z * g * HEMI_R[2]);
};

export function buildNervous(mats: MatFactory): Record<string, THREE.Group> {
  const out: Record<string, THREE.Group> = {};
  type Fill = (g: THREE.Group, m: (kind?: MatKind) => THREE.Material, L: (id: string, kind?: MatKind) => THREE.Material) => void;

  function part(id: string, mirror: boolean, kind: MatKind, fill: Fill, warp?: (x: number, y: number, z: number) => P3): void {
    const m = (k: MatKind = kind) => mats(id, k);
    const L = (lm: string, k: MatKind = kind) => mats(lm, k);
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
    const m = mesh(new THREE.SphereGeometry(1, 22, 16), mat);
    m.position.set(c[0], c[1], c[2]); m.scale.set(r[0], r[1], r[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    g.add(m); return m;
  };
  /** لولهٔ باریک عصبی از چند نقطه */
  const wire = (g: THREE.Object3D, mat: THREE.Material, pts: P3[], r0: number, r1 = r0, radial = 8) => {
    const m = mesh(taper(pts.map(pv), prof([[0, r0], [1, r1]], 0.02), radial), mat);
    g.add(m); return m;
  };
  const wireV = (g: THREE.Object3D, mat: THREE.Material, pts: THREE.Vector3[], r0: number, r1 = r0, radial = 8) => {
    const m = mesh(taper(pts, prof([[0, r0], [1, r1]], 0.02), radial), mat);
    g.add(m); return m;
  };

  /* ───────── مغز ───────── */
  part('cerebrum', true, BRAIN, (g, m, L) => {
    const lobes = hemisphereLobes();
    const mat: Record<string, THREE.Material> = { F: L('frontal-lobe', LOBE_F), P: L('parietal-lobe', LOBE_P), T: L('temporal-lobe', LOBE_T), O: L('occipital-lobe', LOBE_O) };
    Object.keys(lobes).forEach((key) => {
      const piece = mesh(lobes[key], mat[key]);
      piece.position.set(HEMI_C[0], HEMI_C[1], HEMI_C[2]); piece.scale.set(HEMI_R[0], HEMI_R[1], HEMI_R[2]);
      g.add(piece);
    });
    // شیار مرکزی و شیار کناری (سیلویوس)
    const sulcus = (dirs: P3[], r: number, id: string) => g.add(mesh(taper(dirs.map((d) => hemiWorld(d[0], d[1], d[2])), prof([[0, r], [1, r]], 0.05), 6), L(id, '#8E5559')));
    sulcus([[0.05, 0.99, 0.12], [0.35, 0.8, 0.2], [0.65, 0.5, 0.24], [0.9, 0.2, 0.2]], 0.0028, 'central-sulcus');
    sulcus([[0.55, -0.25, 0.7], [0.82, -0.08, 0.35], [0.9, 0.05, 0.0], [0.82, 0.18, -0.35]], 0.0028, 'lateral-sulcus');
    void m;
  });

  part('cerebellum', true, CEREB, (g, m, L) => {
    const geo = new THREE.SphereGeometry(1, 40, 28);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i);
      const f = 1 - 0.045 * (0.5 + 0.5 * Math.sin(y * 42));
      pos.setXYZ(i, pos.getX(i) * f, y * f, pos.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const hemi = mesh(geo, L('cerebellar-hemisphere', CEREB));
    hemi.position.set(0.05, 1.538, -0.125); hemi.scale.set(0.05, 0.04, 0.056);
    g.add(hemi);
    ell(g, L('vermis', '#C98474'), [0.0, 1.54, -0.125], [0.014, 0.036, 0.052]);
    void m;
  });

  part('brainstem', false, STEM, (g, m, L) => {
    const zc = canalZ(1.452);
    wire(g, m(), [[0, 1.58, 0.0], [0, 1.545, -0.012], [0, 1.505, -0.028], [0, 1.468, zc + 0.012], [0, 1.452, zc]], 0.019, 0.0105, 14);
    ell(g, L('midbrain', '#E8B95C'), [0, 1.566, -0.004], [0.019, 0.02, 0.018]);
    ell(g, L('pons', '#EBCB8B'), [0, 1.532, 0.003], [0.026, 0.017, 0.021]);
    wire(g, L('medulla-oblongata', '#D9B26A'), [[0, 1.512, -0.024], [0, 1.488, -0.032], [0, 1.462, zc + 0.01]], 0.0145, 0.0108, 14);
  });

  part('eyes', true, '#F8FAFC', (g, m, L) => {
    ell(g, m(), [0.058, 1.578, 0.122], [0.0215, 0.0215, 0.0215]);
    ell(g, L('cornea-iris', '#4F7A9C'), [0.058, 1.578, 0.1415], [0.0105, 0.0105, 0.004]);
    ell(g, L('pupil', 'dark'), [0.058, 1.578, 0.1448], [0.0045, 0.0045, 0.0018]);
  });

  part('optic-nerves', true, 'nerve', (g, m, L) => {
    wire(g, m(), [[0.058, 1.578, 0.1], [0.05, 1.58, 0.07], [0.028, 1.582, 0.045], [0.008, 1.582, 0.036]], 0.0048, 0.0042);
    ell(g, L('optic-chiasm', '#F7DC74'), [0, 1.582, 0.035], [0.016, 0.0052, 0.0075]);
  });

  /* ───────── نخاع و ریشه‌ها ───────── */
  part('spinal-cord', false, CORD, (g, m, L) => {
    const ys: number[] = [];
    for (let y = CORD_TOP; y > CORD_BOT + 0.001; y -= 0.03) ys.push(y);
    ys.push(CORD_BOT);
    const pts = ys.map((y) => V(0, y, canalZ(y)));
    const t = (y: number) => (CORD_TOP - y) / (CORD_TOP - CORD_BOT);
    g.add(mesh(taper(pts, cordProf, 16), m()));
    const seg = (y0: number, y1: number, id: string, color: MatKind) => {
      const n = 8; const sp: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i += 1) { const y = y0 + ((y1 - y0) * i) / n; sp.push(V(0, y, canalZ(y))); }
      const r = (u: number) => cordR(y0 + (y1 - y0) * u) * 1.06;
      g.add(mesh(taper(sp, r, 16), L(id, color)));
    };
    seg(1.37, 1.22, 'cervical-enlargement', '#FFE79A');
    seg(0.76, 0.58, 'lumbar-enlargement', '#FFE79A');
    seg(0.575, CORD_BOT + 0.004, 'conus-medullaris', '#F2D370');
    void t;
  });

  part('cauda-equina', false, 'nerve', (g, m, L) => {
    const n = 14;
    for (let i = 0; i < n; i += 1) {
      const u = i / (n - 1);
      const side = i % 2 === 0 ? 1 : -1;
      const yEnd = 0.43 - u * 0.4;
      const xEnd = side * (0.006 + 0.01 * (1 - u) + 0.004);
      wire(g, m(), [[side * 0.0015, 0.5, canalZ(0.5)], [side * 0.0045, (0.5 + yEnd) / 2, canalZ((0.5 + yEnd) / 2) + 0.001], [xEnd, yEnd, canalZ(yEnd)]], 0.0021, 0.0017, 6);
    }
    wire(g, L('filum-terminale', '#F4F1E4'), [[0, 0.5, canalZ(0.5)], [0, 0.3, canalZ(0.3)], [0, 0.1, canalZ(0.1)], [0, 0.0, canalZ(0.0)], [0, -0.1, canalZ(0.0) - 0.01]], 0.0016, 0.0011, 6);
  });

  part('spinal-nerves', true, 'nerve', (g, m, L) => {
    const levels: number[] = [];
    for (let i = 0; i < 8; i += 1) levels.push(1.395 - i * 0.026);
    for (let k = 0; k < 12; k += 1) levels.push(ribY(k) - 0.01);
    levels.forEach((y, i) => {
      const zc = canalZ(y);
      const thoracic = i >= 8;
      const end: P3 = thoracic ? (() => { const p = ribXYZ(i - 8, 0.1 * PI); return [p.x, p.y - 0.008, p.z]; })() : [0.07 + (i % 2) * 0.004, y - 0.022, zc + 0.016];
      wire(g, m(), [[0.007, y, zc], [0.026, y - 0.004, zc + 0.002], [(0.026 + end[0]) / 2, (y + end[1]) / 2, (zc + end[2]) / 2], end], 0.0032, 0.0028, 6);
      ell(g, L('dorsal-root-ganglion', '#E4B33D'), [0.03, y - 0.004, zc + 0.002], [0.0078, 0.0048, 0.0052]);
    });
    void m;
  });

  part('intercostal-nerves', true, 'nerve', (g, m) => {
    for (let k = 0; k < 11; k += 1) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i += 1) {
        const p = ribXYZ(k, (0.1 + 0.68 * (i / 12)) * PI, 0.985);
        p.y -= 0.0125;
        pts.push(p);
      }
      wireV(g, m(), pts, 0.0032, 0.0024, 6);
    }
  }, chestWarp);

  part('sympathetic-trunk', true, '#C7D77A', (g, m, L) => {
    const ys: number[] = [];
    for (let y = 1.42; y > 0.14; y -= 0.0545) ys.push(y);
    const pts = ys.map((y) => V(0.034 + (y < 1.2 && y > 0.7 ? 0.007 : 0), y, spineZ(y) + 0.006));
    wireV(g, m(), pts, 0.0028, 0.0026, 6);
    pts.forEach((p) => { ell(g, L('sympathetic-ganglion', '#B5C85A'), [p.x, p.y, p.z], [0.0068, 0.0092, 0.0068]); });
  });

  /* ───────── اعصاب سر و تنه ───────── */
  part('vagus-nerve', true, 'nerve', (g, m) => {
    wire(g, m(), [[0.014, 1.5, -0.026], [0.03, 1.47, -0.005], [0.04, 1.38, 0.022], [0.048, 1.25, 0.04], [0.05, 1.12, 0.05], [0.042, 0.98, 0.07], [0.03, 0.82, 0.088], [0.026, 0.68, 0.1], [0.03, 0.6, 0.115]], 0.0058, 0.0042, 8);
  });

  part('phrenic-nerve', true, 'nerve', (g, m) => {
    wire(g, m(), [[0.01, 1.31, canalZ(1.31)], [0.05, 1.27, 0.0], [0.065, 1.2, 0.04], [0.09, 1.1, 0.07], [0.115, 0.95, 0.088], [0.125, 0.8, 0.09], [0.12, 0.68, 0.08]], 0.0042, 0.0034, 8);
  });

  /* ───────── اعصاب دست ───────── */
  const PLEX: P3 = [0.14, 1.15, -0.012];
  const AXILLA: P3 = [0.305, 1.07, 0.0];
  part('brachial-plexus', true, 'nerve', (g, m, L) => {
    [1.31, 1.28, 1.25, 1.22, 1.185].forEach((y, i) => {
      wire(g, L('plexus-roots', '#F7DC74'), [[0.008, y, canalZ(y)], [0.04, y - 0.01, canalZ(y) + 0.012], [0.09, 1.16 + (i - 2) * 0.01, -0.015], PLEX], 0.0042, 0.0045, 7);
    });
    [[0.0, 0.02], [0.012, 0.0], [-0.012, -0.018]].forEach((o, i) => {
      wire(g, L('plexus-cords', '#EDC23A'), [PLEX, [0.19, 1.125 + o[0], -0.004 + o[1] * 0.4], [0.25, 1.1 + o[0] * 0.7, o[1] * 0.5], [AXILLA[0], AXILLA[1] + o[0] * 0.5, AXILLA[2] + o[1] * 0.5]], 0.0068, 0.0058, 8);
      void i;
    });
    void m;
  });

  part('musculocutaneous-nerve', true, '#E9A94B', (g, m) => {
    wire(g, m(), [[0.305, 1.068, 0.01], [0.345, 0.98, 0.034], [0.385, 0.85, 0.044], [0.425, 0.62, 0.045], [0.458, 0.42, 0.04], [0.495, 0.28, 0.046], [0.515, 0.1, 0.045], [0.532, -0.05, 0.038]], 0.0042, 0.0028, 8);
  });
  part('axillary-nerve', true, '#EDBE4B', (g, m) => {
    wire(g, m(), [[0.305, 1.066, -0.01], [0.335, 1.04, -0.032], [0.378, 1.005, -0.04], [0.41, 1.0, -0.006], [0.415, 1.02, 0.036], [0.4, 1.06, 0.045]], 0.0045, 0.003, 8);
  });
  part('radial-nerve', true, '#E5B92B', (g, m) => {
    wire(g, m(), [[0.305, 1.066, -0.018], [0.355, 0.97, -0.04], [0.405, 0.8, -0.05], [0.45, 0.62, -0.045], [0.5, 0.5, -0.016], [0.5, 0.4, 0.014], [0.515, 0.25, -0.02], [0.532, 0.05, -0.036], [0.548, -0.1, -0.026], [0.56, -0.18, -0.012]], 0.0058, 0.0034, 8);
    // شاخه‌های پشت دست
    [[0.575, -0.27, -0.002], [0.545, -0.3, -0.004], [0.52, -0.3, -0.004]].forEach((e, i) => {
      wire(g, m(), [[0.55, -0.12, -0.026], [0.55 + (e[0] - 0.55) * 0.5, -0.19 - i * 0.004, -0.014], [e[0], e[1], e[2]]], 0.0018, 0.0012, 6);
    });
  });
  part('median-nerve', true, '#F5D547', (g, m, L) => {
    wire(g, m(), [[0.305, 1.066, 0.012], [0.35, 0.95, 0.024], [0.4, 0.75, 0.028], [0.43, 0.55, 0.03], [0.44, 0.4, 0.04], [0.475, 0.25, 0.048], [0.512, 0.05, 0.044], [0.525, -0.08, 0.036]], 0.0058, 0.0042, 8);
    wire(g, L('carpal-tunnel', '#FFE45C'), [[0.525, -0.08, 0.036], [0.527, -0.12, 0.03], [0.527, -0.158, 0.027]], 0.0042, 0.004, 8);
    // شاخه‌های رقمی کف دست (شست، اشاره، میانی و نیمی از حلقه)
    [[0.589, -0.235, 0.04], [0.555, -0.3, 0.022], [0.536, -0.32, 0.022], [0.517, -0.31, 0.02]].forEach((e, i) => {
      wire(g, m(), [[0.527, -0.158, 0.027], [0.527 + (e[0] - 0.527) * 0.5, -0.2 - i * 0.004, 0.024 + i * 0.001], [e[0], e[1], e[2]]], 0.0021, 0.0013, 6);
    });
  });
  part('ulnar-nerve', true, '#EDC23A', (g, m, L) => {
    wire(g, m(), [[0.305, 1.066, -0.004], [0.34, 0.96, -0.012], [0.378, 0.78, -0.026], [0.404, 0.55, -0.034], [0.408, 0.42, -0.034]], 0.0055, 0.0045, 8);
    wire(g, L('cubital-tunnel', '#F5D35A'), [[0.408, 0.42, -0.034], [0.418, 0.385, -0.03], [0.44, 0.34, -0.018]], 0.0046, 0.0044, 8);
    wire(g, m(), [[0.44, 0.34, -0.018], [0.466, 0.2, 0.0], [0.5, -0.02, 0.014], [0.512, -0.11, 0.02], [0.52, -0.158, 0.026]], 0.0044, 0.0034, 8);
    [[0.506, -0.3, 0.02], [0.49, -0.285, 0.02]].forEach((e, i) => {
      wire(g, m(), [[0.52, -0.158, 0.026], [0.512, -0.22 - i * 0.004, 0.024], [e[0], e[1], e[2]]], 0.0021, 0.0013, 6);
    });
  });

  /* ───────── اعصاب پا ───────── */
  const LUMB: P3 = [0.115, 0.17, 0.0];
  const SACR: P3 = [0.12, -0.01, -0.062];
  part('lumbosacral-plexus', true, 'nerve', (g, m, L) => {
    [0.52, 0.45, 0.385, 0.32, 0.26].forEach((y, i) => {
      wire(g, L('plexus-roots', '#F7DC74'), [[0.006, y, canalZ(y)], [0.04, y - 0.01, canalZ(y) + 0.01], [0.075, 0.33 - i * 0.045, -0.034 + i * 0.004], LUMB], 0.0042, 0.0045, 7);
    });
    [0.2, 0.15, 0.1, 0.05].forEach((y, i) => {
      wire(g, L('plexus-roots', '#F7DC74'), [[0.004, y, canalZ(y)], [0.026, y - 0.01, canalZ(y) - 0.01], [0.07 + i * 0.01, 0.02 - i * 0.012, -0.075], SACR], 0.0042, 0.0048, 7);
    });
    void m;
  }, (x, y, z) => [x * pelvisWidth(y), y, z]);
  part('femoral-nerve', true, '#F5D547', (g, m) => {
    wire(g, m(), [LUMB, [0.14, 0.08, 0.03], [0.155, -0.04, 0.07], [0.162, -0.3, 0.08], [0.168, -0.65, 0.082], [0.148, -0.93, 0.08]], 0.0072, 0.0038, 8);
  }, hipLegWarp);
  part('obturator-nerve', true, '#EDB74B', (g, m) => {
    wire(g, m(), [LUMB, [0.12, 0.08, 0.04], [0.125, -0.04, 0.075], [0.105, -0.22, 0.045], [0.088, -0.44, 0.022]], 0.0056, 0.003, 8);
  }, hipLegWarp);
  part('saphenous-nerve', true, '#F0C95A', (g, m) => {
    wire(g, m(), [[0.148, -0.93, 0.08], [0.14, -1.0, 0.052], [0.136, -1.2, 0.038], [0.13, -1.5, 0.034], [0.13, -1.72, 0.03], [0.124, -1.76, 0.06], [0.126, -1.787, 0.1]], 0.0034, 0.0022, 7);
  });
  part('sciatic-nerve', true, '#EDC23A', (g, m, L) => {
    wire(g, m(), [SACR, [0.135, -0.1, -0.07], [0.158, -0.25, -0.05], [0.164, -0.55, -0.04], [0.162, -0.85, -0.03], [0.16, -0.94, -0.028]], 0.0125, 0.0082, 10);
    ell(g, L('sciatic-bifurcation', '#F5D14D'), [0.16, -0.94, -0.028], [0.0105, 0.012, 0.0095]);
  }, hipLegWarp);
  part('tibial-nerve', true, '#E5B92B', (g, m, L) => {
    wire(g, m(), [[0.16, -0.94, -0.028], [0.156, -1.01, -0.05], [0.15, -1.3, -0.034], [0.14, -1.6, -0.03], [0.134, -1.72, -0.03]], 0.0078, 0.0046, 9);
    wire(g, L('tarsal-tunnel', '#F4CE46'), [[0.134, -1.72, -0.03], [0.13, -1.745, -0.026], [0.134, -1.77, -0.012]], 0.0046, 0.0042, 8);
  });
  part('plantar-nerves', true, '#F0C14A', (g, m) => {
    TOES_X.forEach((x, i) => {
      wire(g, m(), [[0.134, -1.77, -0.012], [(0.134 + x) / 2, -1.784, 0.04], [x, -1.787, 0.09 + i * 0.002], [x + (i - 2) * 0.004, -1.787, 0.2 - i * 0.01]], 0.0026, 0.0015, 6);
    });
  });
  part('fibular-nerve', true, '#F2C94C', (g, m) => {
    wire(g, m(), [[0.16, -0.94, -0.028], [0.188, -1.0, -0.026], [0.208, -1.032, -0.002], [0.216, -1.07, 0.02], [0.2, -1.3, 0.04], [0.185, -1.55, 0.044], [0.172, -1.74, 0.048], [0.168, -1.78, 0.085]], 0.0058, 0.0032, 8);
  });
  part('sural-nerve', true, '#F3D26A', (g, m) => {
    wire(g, m(), [[0.168, -1.0, -0.048], [0.168, -1.2, -0.044], [0.17, -1.45, -0.04], [0.188, -1.68, -0.03], [0.208, -1.74, -0.016], [0.222, -1.782, 0.0]], 0.0032, 0.0022, 7);
  });

  return out;
}

