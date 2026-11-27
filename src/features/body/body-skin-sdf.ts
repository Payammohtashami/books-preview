/**
 * پوست یک‌تکهٔ بدن به‌صورت میدان فاصلهٔ علامت‌دار (SDF): اجزای نرم (تنه، سر و صورت، گردن، دست و انگشت، پا و پنجه)
 * با اتحاد نرم (smooth-min) یکی می‌شوند، روی شبکه نمونه‌برداری و با Surface Nets به یک مش پیوسته و بی‌درز تبدیل
 * و با هموارسازی تاوبین صاف می‌شوند. بدون وابستگی به three تا در Web Worker هم اجرا شود.
 * مختصات هم‌خوان با skeleton-3d.ts: x جانبی، y بالا، z جلو؛ کف پا y ≈ −۱٫۸.
 */

/** تنه: [y, نیم‌پهنا، z جلو، z عقب] از گردن تا فرورفتگی ران */
export const TORSO: number[][] = [
  [1.32, 0.085, 0.045, -0.095], [1.25, 0.125, 0.07, -0.115], [1.17, 0.215, 0.115, -0.14], [1.1, 0.3, 0.15, -0.165],
  [1.02, 0.305, 0.185, -0.172], [0.92, 0.3, 0.205, -0.168], [0.8, 0.29, 0.205, -0.165], [0.68, 0.275, 0.19, -0.158],
  [0.56, 0.245, 0.168, -0.145], [0.44, 0.235, 0.165, -0.14], [0.32, 0.265, 0.175, -0.155], [0.18, 0.31, 0.17, -0.2],
  [0.05, 0.32, 0.15, -0.215], [-0.06, 0.3, 0.13, -0.2], [-0.14, 0.24, 0.1, -0.15],
];

/* ───────────────────── پوست یک‌تکه با میدان فاصله ───────────────────── */

type Vec = [number, number, number];
/** یک جزء نرم: تابع فاصله، جعبهٔ محدوده و شعاع اتحاد نرم با بقیه */
interface Prim { f: (x: number, y: number, z: number) => number; lo: Vec; hi: Vec; k: number; sub?: boolean }

const smin = (a: number, b: number, k: number) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

/** مخروط گرد (کپسول با دو شعاع) میان a و b */
function roundCone(a: Vec, b: Vec, ra: number, rb: number, k: number): Prim {
  const bx = b[0] - a[0]; const by = b[1] - a[1]; const bz = b[2] - a[2];
  const l2 = bx * bx + by * by + bz * bz; const rr = ra - rb; const a2 = l2 - rr * rr; const il2 = 1 / l2;
  const f = (x: number, y: number, z: number) => {
    const px = x - a[0]; const py = y - a[1]; const pz = z - a[2];
    const yv = px * bx + py * by + pz * bz; const zv = yv - l2;
    const qx = px * l2 - bx * yv; const qy = py * l2 - by * yv; const qz = pz * l2 - bz * yv;
    const x2 = qx * qx + qy * qy + qz * qz; const y2 = yv * yv * l2; const z2 = zv * zv * l2;
    const kk = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > kk) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yv) * a2 * y2 < kk) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
  };
  const m = Math.max(ra, rb);
  return { f, lo: [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m], hi: [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m], k };
}
/** زنجیرهٔ مخروط‌های گرد روی نقاط [x,y,z,r]؛ کل زنجیره یک جزء است و یکجا با بقیه نرم می‌شود */
function chain(pts: number[][], k: number): Prim {
  const segs: Prim[] = [];
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const a = pts[i]; const b = pts[i + 1];
    segs.push(roundCone([a[0], a[1], a[2]], [b[0], b[1], b[2]], a[3], b[3], 0));
  }
  const lo: Vec = [9, 9, 9]; const hi: Vec = [-9, -9, -9];
  segs.forEach((q) => { for (let c = 0; c < 3; c += 1) { lo[c] = Math.min(lo[c], q.lo[c]); hi[c] = Math.max(hi[c], q.hi[c]); } });
  const mg = k + 0.03;
  const f = (x: number, y: number, z: number) => {
    let d = 1e9;
    for (const q of segs) { if (y < q.lo[1] - mg || y > q.hi[1] + mg) continue; const v = q.f(x, y, z); if (v < d) d = v; }
    return d === 1e9 ? mg : d;
  };
  return { f, lo, hi, k };
}
/** بیضی‌گون (تقریب فاصلهٔ iq) با چرخش اختیاری حول y و x */
function ellipsoid(c: Vec, r: Vec, k: number, rotY = 0, rotX = 0, sub = false): Prim {
  const cy = Math.cos(rotY); const sy = Math.sin(rotY); const cx = Math.cos(rotX); const sx = Math.sin(rotX);
  const f = (x: number, y: number, z: number) => {
    let px = x - c[0]; let py = y - c[1]; let pz = z - c[2];
    const tx = cy * px - sy * pz; pz = sy * px + cy * pz; px = tx;
    const ty = cx * py + sx * pz; pz = -sx * py + cx * pz; py = ty;
    const ax = px / r[0]; const ay = py / r[1]; const az = pz / r[2];
    const k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / r[0]; const by = ay / r[1]; const bz = az / r[2];
    const k1 = Math.sqrt(bx * bx + by * by + bz * bz) || 1e-9;
    return (k0 * (k0 - 1)) / k1;
  };
  const m = Math.max(r[0], r[1], r[2]);
  return { f, lo: [c[0] - m, c[1] - m, c[2] - m], hi: [c[0] + m, c[1] + m, c[2] + m], k, sub };
}
/** جعبهٔ گرد (برای کف دست) */
function roundBox(c: Vec, h: Vec, r: number, k: number, rotX = 0): Prim {
  const cx = Math.cos(rotX); const sx = Math.sin(rotX);
  const f = (x: number, y: number, z: number) => {
    const px = x - c[0]; let py = y - c[1]; let pz = z - c[2];
    const ty = cx * py + sx * pz; pz = -sx * py + cx * pz; py = ty;
    const qx = Math.abs(px) - h[0]; const qy = Math.abs(py) - h[1]; const qz = Math.abs(pz) - h[2];
    const ox = Math.max(qx, 0); const oy = Math.max(qy, 0); const oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
  const m = Math.max(h[0], h[1], h[2]) + r;
  return { f, lo: [c[0] - m, c[1] - m, c[2] - m], hi: [c[0] + m, c[1] + m, c[2] + m], k };
}

/** تنه از جدول مقطع‌ها (بیضی گوشه‌دار با پهنا و عمق متغیر) */
const TORSO_SKIN: number[][] = [
  ...TORSO.slice(0, -2),
  [-0.05, 0.27, 0.125, -0.19], [-0.12, 0.16, 0.09, -0.13], [-0.165, 0.065, 0.06, -0.07], [-0.185, 0.02, 0.03, -0.03],
];
/** عمق اضافهٔ پشت (زائده‌های خاری، کتف و ماهیچه‌های راست‌کننده) و جلوی بالای سینه */
const bell = (y: number, c: number, w: number) => Math.exp(-(((y - c) / w) ** 2));
function torsoRowAt(y: number): number[] {
  const r = torsoRowRaw(y);
  return [y, r[1], r[2] + 0.035 * bell(y, 1.13, 0.1) + 0.01 * bell(y, 0.55, 0.25), r[3] - 0.06 * bell(y, 0.8, 0.48) - 0.02 * bell(y, 1.15, 0.12)];
}
function torsoRowRaw(y: number): number[] {
  const R = TORSO_SKIN; const n = R.length;
  if (y >= R[0][0]) return R[0];
  if (y <= R[n - 1][0]) return R[n - 1];
  let i = 0;
  while (i + 1 < n && y < R[i + 1][0]) i += 1;
  const t = (R[i][0] - y) / (R[i][0] - R[i + 1][0]);
  const r0 = R[Math.max(0, i - 1)]; const r1 = R[i]; const r2 = R[i + 1]; const r3 = R[Math.min(n - 1, i + 2)];
  const c = (q: number) => 0.5 * ((2 * r1[q]) + (-r0[q] + r2[q]) * t + (2 * r0[q] - 5 * r1[q] + 4 * r2[q] - r3[q]) * t * t + (-r0[q] + 3 * r1[q] - 3 * r2[q] + r3[q]) * t * t * t);
  return [y, c(1), c(2), c(3)];
}
function torso(): Prim {
  const top = TORSO_SKIN[0][0]; const bot = TORSO_SKIN[TORSO_SKIN.length - 1][0]; const n = 2.35;
  let lastY = NaN; let r: number[] = TORSO_SKIN[0];
  const f = (x: number, y: number, z: number) => {
    if (y !== lastY) { r = torsoRowAt(y); lastY = y; }
    const A = r[1]; const hd = (r[2] - r[3]) / 2; const zc = (r[2] + r[3]) / 2;
    const kx = Math.abs(x) / A; const kz = Math.abs(z - zc) / hd;
    const kk = (kx ** n + kz ** n) ** (1 / n);
    const d = (kk - 1) * Math.min(A, hd);
    return smax(smax(d, y - top, 0.03), bot - y, 0.03);
  };
  return { f, lo: [0, bot - 0.02, -0.25], hi: [0.36, top + 0.02, 0.24], k: 0.05 };
}

/** همهٔ اجزای نیمهٔ راست بدن (و اجزای وسط) */
function bodyPrims(): Prim[] {
  const P: Prim[] = [];
  const add = (...ps: Prim[]) => { P.push(...ps); };

  /* تنه، سینه، باسن و کتف */
  add(torso());
  add(ellipsoid([0.115, 0.95, 0.14], [0.1, 0.07, 0.05], 0.06));
  add(ellipsoid([0.115, -0.02, -0.14], [0.125, 0.13, 0.075], 0.08));
  add(ellipsoid([0.17, 0.98, -0.13], [0.15, 0.14, 0.06], 0.06));
  add(ellipsoid([0.2, 0.12, -0.12], [0.08, 0.1, 0.07], 0.07));

  /* گردن */
  add(roundCone([0, 1.23, -0.025], [0, 1.4, -0.04], 0.1, 0.082, 0.08));
  add(roundCone([0.075, 1.45, -0.025], [0.035, 1.2, 0.1], 0.026, 0.022, 0.06));

  add(ellipsoid([0, 1.19, 0.045], [0.1, 0.07, 0.075], 0.06));

  /* سر: جمجمه، صورت، فک، چانه، گونه، ابرو، بینی، لب، گوش و حفرهٔ چشم */
  add(ellipsoid([0, 1.638, -0.03], [0.176, 0.177, 0.206], 0.05));
  add(ellipsoid([0, 1.53, -0.13], [0.12, 0.08, 0.08], 0.05));
  add(ellipsoid([0, 1.54, 0.045], [0.122, 0.13, 0.13], 0.05));
  add(ellipsoid([0, 1.455, 0.1], [0.072, 0.055, 0.065], 0.05));
  add(roundCone([0.098, 1.475, -0.005], [0.04, 1.39, 0.11], 0.026, 0.028, 0.05));
  add(ellipsoid([0, 1.388, 0.128], [0.055, 0.032, 0.03], 0.06));
  add(ellipsoid([0.078, 1.545, 0.11], [0.045, 0.032, 0.04], 0.05));
  add(ellipsoid([0.052, 1.59, 0.19], [0.034, 0.022, 0.026], 0.02, 0, 0, true));
  add(ellipsoid([0.052, 1.587, 0.155], [0.023, 0.015, 0.02], 0.01));
  add(roundCone([0, 1.6, 0.168], [0, 1.52, 0.2], 0.01, 0.016, 0.025));
  add(ellipsoid([0, 1.508, 0.186], [0.026, 0.013, 0.016], 0.016));
  add(ellipsoid([0, 1.465, 0.168], [0.037, 0.011, 0.013], 0.016));
  add(ellipsoid([0, 1.444, 0.163], [0.032, 0.012, 0.013], 0.016));
  add(ellipsoid([0, 1.455, 0.181], [0.034, 0.003, 0.012], 0.005, 0, 0, true));
  add(ellipsoid([0.163, 1.56, -0.03], [0.014, 0.043, 0.028], 0.016, 0.35));
  add(ellipsoid([0.175, 1.56, -0.028], [0.006, 0.028, 0.017], 0.006, 0.35, 0, true));

  /* شانه و بازو و ساعد (ضخامت بافت نرم نزدیک به نسبت‌های واقعی) */
  add(ellipsoid([0.35, 1.03, -0.01], [0.09, 0.12, 0.095], 0.08));
  add(ellipsoid([0.3, 1.08, -0.1], [0.08, 0.08, 0.065], 0.06));
  add(ellipsoid([0.335, 1.06, 0.065], [0.08, 0.085, 0.07], 0.06));
  add(chain([
    [0.35, 1.04, -0.01, 0.085], [0.378, 0.93, -0.008, 0.082], [0.408, 0.74, -0.008, 0.08], [0.43, 0.56, -0.008, 0.07],
    [0.445, 0.42, -0.008, 0.064], [0.465, 0.3, 0.0, 0.068], [0.49, 0.12, 0.0, 0.056], [0.512, -0.02, 0.0, 0.045], [0.527, -0.12, 0.012, 0.036],
  ], 0.05));
  add(ellipsoid([0.395, 0.72, 0.045], [0.065, 0.18, 0.058], 0.05));
  add(ellipsoid([0.41, 0.98, 0.05], [0.06, 0.09, 0.06], 0.05));
  add(ellipsoid([0.415, 1.0, -0.06], [0.055, 0.08, 0.05], 0.05));
  add(ellipsoid([0.4, 0.72, -0.05], [0.055, 0.15, 0.05], 0.05));
  add(ellipsoid([0.49, 0.38, 0.03], [0.05, 0.1, 0.045], 0.05));
  add(ellipsoid([0.5, 0.2, -0.03], [0.05, 0.13, 0.045], 0.05));
  add(ellipsoid([0.463, 0.25, 0.01], [0.06, 0.13, 0.055], 0.05));

  /* کف دست، انگشت‌ها و شست */
  add(roundBox([0.538, -0.205, 0.014], [0.032, 0.06, 0.007], 0.014, 0.035));
  const F = [[0.559, 0.03, 0.116, 0.0122], [0.538, 0.0, 0.128, 0.0126], [0.519, -0.01, 0.124, 0.0122], [0.493, -0.07, 0.108, 0.0112]];
  F.forEach(([x, tilt, len, r]) => {
    const y0 = -0.262; const x1 = x + tilt * len;
    add(chain([[x, y0, 0.01, r], [x + (x1 - x) * 0.45, y0 - len * 0.45, 0.011, r * 0.93], [x + (x1 - x) * 0.78, y0 - len * 0.78, 0.012, r * 0.86], [x1, y0 - len, 0.012, r * 0.8]], 0.006));
  });
  add(chain([[0.55, -0.15, 0.03, 0.021], [0.576, -0.2, 0.042, 0.017], [0.598, -0.245, 0.049, 0.0148], [0.612, -0.29, 0.05, 0.013]], 0.016));

  /* ران، زانو، ساق (مرکز بافت کمی داخلی‌تر از استخوان ران) */
  add(chain([
    [0.175, -0.01, -0.012, 0.142], [0.198, -0.12, 0.01, 0.15], [0.205, -0.28, 0.022, 0.14], [0.194, -0.48, 0.022, 0.128],
    [0.176, -0.72, 0.025, 0.108], [0.16, -0.9, 0.035, 0.085], [0.158, -1.0, 0.012, 0.082], [0.157, -1.08, -0.005, 0.078],
    [0.156, -1.22, -0.028, 0.082], [0.153, -1.42, -0.02, 0.062], [0.15, -1.6, 0.0, 0.046], [0.152, -1.72, 0.0, 0.044],
  ], 0.13));
  add(ellipsoid([0.2, -0.58, -0.05], [0.07, 0.22, 0.065], 0.07));
  add(ellipsoid([0.18, -1.32, 0.035], [0.042, 0.17, 0.042], 0.05));
  add(ellipsoid([0.158, -0.985, 0.088], [0.034, 0.038, 0.02], 0.04));
  add(ellipsoid([0.135, -1.2, -0.06], [0.055, 0.13, 0.055], 0.06));
  add(ellipsoid([0.178, -1.19, -0.05], [0.045, 0.12, 0.05], 0.06));

  /* پاشنه، کف پا و انگشت‌ها؛ کف صاف می‌شود */
  add(ellipsoid([0.155, -1.755, -0.08], [0.042, 0.045, 0.05], 0.04));
  add(ellipsoid([0.138, -1.76, -0.01], [0.02, 0.022, 0.03], 0.03));
  add(ellipsoid([0.172, -1.765, -0.01], [0.02, 0.022, 0.03], 0.03));
  add(roundCone([0.155, -1.735, -0.035], [0.17, -1.77, 0.18], 0.052, 0.03, 0.04));
  add(ellipsoid([0.172, -1.778, 0.17], [0.072, 0.028, 0.08], 0.04));
  add(ellipsoid([0.19, -1.772, 0.03], [0.05, 0.03, 0.08], 0.04));
  [[0.13, 0.305, 0.0155], [0.154, 0.288, 0.012], [0.176, 0.276, 0.0112], [0.197, 0.264, 0.0105], [0.216, 0.248, 0.0098]].forEach(([x, tip, r]) => {
    add(chain([[x, -1.784, 0.222, r * 1.05], [x + 0.001, -1.787, (0.222 + tip) / 2, r * 0.95], [x + 0.002, -1.789, tip, r * 0.88]], 0.014));
  });
  return P;
}

/** ضخامت بافت زیرپوستی: پوست کمی بیرون‌تر از اجزای درونی؛ در سر، دست و پا نازک‌تر تا جزئیات بماند */
function fat(x: number, y: number): number {
  const ss = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const thin = Math.max(ss(1.25, 1.34, y), ss(-0.05, -0.15, y) * ss(0.47, 0.52, x), ss(-1.66, -1.72, y));
  return 0.011 - 0.008 * thin;
}

/** کف پا: صاف‌کردن زیر y = −۱٫۸۰۴ */
const SOLE = -1.804;

/**
 * ساخت مش یک‌تکه: نمونه‌برداری SDF روی نیمهٔ راست، Surface Nets، آینه‌کردن و دوختن در خط وسط، و هموارسازی.
 * h اندازهٔ سلول شبکه است.
 */
export interface SkinArrays { pos: Float32Array; index: Uint32Array }

export function buildSkinArrays(h = 0.008): SkinArrays {
  const prims = bodyPrims();
  const X0 = -h / 2; const Y0 = -1.83; const Z0 = -0.29;
  const nx = Math.ceil((0.66 - X0) / h) + 1; const ny = Math.ceil((1.84 - Y0) / h) + 1; const nz = Math.ceil((0.35 - Z0) / h) + 1;
  const sxy = nx * ny;
  const grid = new Float32Array(nx * ny * nz).fill(1);
  const idx = (i: number, j: number, k: number) => i + j * nx + k * sxy;

  const deep = 0.05;
  for (const p of prims) {
    const m = p.k + 2.5 * h;
    const i0 = Math.max(0, Math.floor((p.lo[0] - m - X0) / h)); const i1 = Math.min(nx - 1, Math.ceil((p.hi[0] + m - X0) / h));
    const j0 = Math.max(0, Math.floor((p.lo[1] - m - Y0) / h)); const j1 = Math.min(ny - 1, Math.ceil((p.hi[1] + m - Y0) / h));
    const k0 = Math.max(0, Math.floor((p.lo[2] - m - Z0) / h)); const k1 = Math.min(nz - 1, Math.ceil((p.hi[2] + m - Z0) / h));
    for (let k = k0; k <= k1; k += 1) {
      const z = Z0 + k * h;
      for (let j = j0; j <= j1; j += 1) {
        const y = Y0 + j * h;
        let o = idx(i0, j, k);
        for (let i = i0; i <= i1; i += 1, o += 1) {
          if (!p.sub && grid[o] < -deep) continue; // عمق درون بدن؛ اثری بر سطح ندارد
          const x = Math.abs(X0 + i * h);
          const d = p.f(x, y, z);
          grid[o] = p.sub ? smax(grid[o], -d, p.k) : smin(grid[o], d, p.k);
        }
      }
    }
  }
  // ضخامت زیرپوستی و کف پای صاف
  for (let k = 0; k < nz; k += 1) for (let j = 0; j < ny; j += 1) {
    const y = Y0 + j * h;
    for (let i = 0; i < nx; i += 1) {
      const o = idx(i, j, k);
      if (grid[o] > 0.2) continue;
      let d = grid[o] - fat(Math.abs(X0 + i * h), y);
      if (y < SOLE + 0.03) d = smax(d, SOLE - y, 0.012);
      grid[o] = d;
    }
  }

  // Surface Nets روی نیمهٔ راست؛ ستون صفر (x = −h/2) قرینهٔ ستون یک است، پس رأس‌های سلول صفر روی x = 0 می‌افتند
  const cnx = nx - 1; const cny = ny - 1;
  const vid = new Int32Array(cnx * cny * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + j * cnx + k * cnx * cny;
  const pos: number[] = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  const OFF = C.map(([a, b, c]) => a + b * nx + c * sxy);
  const far = 4 * h;
  for (let k = 0; k < nz - 1; k += 1) for (let j = 0; j < ny - 1; j += 1) {
    const row = j * nx + k * sxy;
    for (let i = 0; i < nx - 1; i += 1) {
    const o = row + i;
    if (grid[o] > far || grid[o] < -far) continue;
    let neg = 0;
    for (let c = 0; c < 8; c += 1) { v[c] = grid[o + OFF[c]]; if (v[c] < 0) neg += 1; }
    if (neg === 0 || neg === 8) continue;
    let ax = 0; let ay = 0; let az = 0; let n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      ax += C[a][0] + (C[b][0] - C[a][0]) * t; ay += C[a][1] + (C[b][1] - C[a][1]) * t; az += C[a][2] + (C[b][2] - C[a][2]) * t; n += 1;
    }
    vid[cidx(i, j, k)] = pos.length / 3;
    pos.push(i === 0 ? 0 : X0 + (i + ax / n) * h, Y0 + (j + ay / n) * h, Z0 + (k + az / n) * h);
    }
  }
  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, d, c, a, c, b); else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k += 1) for (let j = 1; j < ny - 1; j += 1) for (let i = 1; i < nx - 1; i += 1) {
    if (vid[cidx(i, j, k)] < 0) continue; // لبه‌های این نقطه از همین سلول می‌گذرند
    const g0 = grid[idx(i, j, k)] < 0;
    if (g0 !== (grid[idx(i + 1, j, k)] < 0)) quad(vid[cidx(i, j - 1, k - 1)], vid[cidx(i, j, k - 1)], vid[cidx(i, j, k)], vid[cidx(i, j - 1, k)], !g0);
    if (g0 !== (grid[idx(i, j + 1, k)] < 0)) quad(vid[cidx(i - 1, j, k - 1)], vid[cidx(i - 1, j, k)], vid[cidx(i, j, k)], vid[cidx(i, j, k - 1)], !g0);
    if (g0 !== (grid[idx(i, j, k + 1)] < 0)) quad(vid[cidx(i - 1, j - 1, k)], vid[cidx(i, j - 1, k)], vid[cidx(i, j, k)], vid[cidx(i - 1, j, k)], !g0);
  }

  // آینه و دوخت: رأس‌های روی x = 0 مشترک می‌مانند
  const nv = pos.length / 3;
  const mir = new Int32Array(nv);
  const all = pos.slice();
  for (let q = 0; q < nv; q += 1) {
    if (pos[q * 3] === 0) { mir[q] = q; continue; }
    mir[q] = all.length / 3; all.push(-pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]);
  }
  const nt = tris.length;
  for (let t = 0; t < nt; t += 3) tris.push(mir[tris[t]], mir[tris[t + 2]], mir[tris[t + 1]]);

  smooth(all, tris, 3);
  return { pos: new Float32Array(all), index: new Uint32Array(tris) };
}

/** هموارسازی تاوبین (بدون کوچک‌شدن حجم) */
function smooth(pos: number[], tris: number[], iters: number) {
  const n = pos.length / 3;
  const deg = new Uint16Array(n);
  const adj: number[][] = Array.from({ length: n }, () => []);
  const link = (a: number, b: number) => { if (!adj[a].includes(b)) { adj[a].push(b); deg[a] += 1; } };
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t]; const b = tris[t + 1]; const c = tris[t + 2];
    link(a, b); link(b, a); link(b, c); link(c, b); link(a, c); link(c, a);
  }
  const tmp = new Float32Array(pos.length);
  const pass = (lam: number) => {
    for (let q = 0; q < n; q += 1) {
      const nb = adj[q]; if (!nb.length) { tmp[q * 3] = pos[q * 3]; tmp[q * 3 + 1] = pos[q * 3 + 1]; tmp[q * 3 + 2] = pos[q * 3 + 2]; continue; }
      let sx = 0; let sy = 0; let sz = 0;
      for (const o of nb) { sx += pos[o * 3]; sy += pos[o * 3 + 1]; sz += pos[o * 3 + 2]; }
      const m = 1 / nb.length;
      tmp[q * 3] = pos[q * 3] + lam * (sx * m - pos[q * 3]);
      tmp[q * 3 + 1] = pos[q * 3 + 1] + lam * (sy * m - pos[q * 3 + 1]);
      tmp[q * 3 + 2] = pos[q * 3 + 2] + lam * (sz * m - pos[q * 3 + 2]);
    }
    for (let q = 0; q < pos.length; q += 1) pos[q] = tmp[q];
  };
  for (let it = 0; it < iters; it += 1) { pass(0.5); pass(-0.53); }
}


/** فاصلهٔ علامت‌دار تا سطح پوست (برای آزمون و هم‌خوانی لایه‌ها) */
export function skinDistance(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  let d = 1;
  for (const p of skinPrims()) {
    const m = p.k + 0.02;
    if (ax < p.lo[0] - m || ax > p.hi[0] + m || y < p.lo[1] - m || y > p.hi[1] + m || z < p.lo[2] - m || z > p.hi[2] + m) continue;
    const v = p.f(ax, y, z);
    d = p.sub ? smax(d, -v, p.k) : smin(d, v, p.k);
  }
  d -= fat(ax, y);
  return y < SOLE + 0.03 ? smax(d, SOLE - y, 0.012) : d;
}
let primCache: Prim[] | null = null;
const skinPrims = () => { if (!primCache) primCache = bodyPrims(); return primCache; };
