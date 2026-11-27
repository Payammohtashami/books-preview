export type V3 = [number, number, number];

const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export interface Prim { f: (x: number, y: number, z: number) => number; k: number; lo: V3; hi: V3 }

/** کپسول (مخروط گرد) با مقطع بیضوی در جهت z */
export function capsule(a: V3, b: V3, ra: number, rb: number, k: number, sz = 1): Prim {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
  const R = Math.max(ra, rb) * Math.max(1, sz);
  return {
    k,
    f: (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = (z - a[2]) / sz;
      const t = clamp((px * ab[0] + py * ab[1] + pz * ab[2]) / l2);
      const dx = px - ab[0] * t, dy = py - ab[1] * t, dz = pz - ab[2] * t;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
    },
    lo: [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.min(a[2], b[2]) - R],
    hi: [Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, Math.max(a[2], b[2]) + R],
  };
}
export function ellip(c: V3, r: V3, k: number): Prim {
  return {
    k,
    f: (x, y, z) => {
      const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
      const k0 = Math.sqrt(px * px + py * py + pz * pz);
      const qx = px / r[0], qy = py / r[1], qz = pz / r[2];
      const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      return k1 < 1e-6 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
    },
    lo: [c[0] - r[0] * 1.1, c[1] - r[1] * 1.1, c[2] - r[2] * 1.1],
    hi: [c[0] + r[0] * 1.1, c[1] + r[1] * 1.1, c[2] + r[2] * 1.1],
  };
}

/** نمونه‌برداری SDF روی شبکه + Surface Nets + هموارسازی تاوبین */
export function sdfMesh(prims: Prim[], bnd: [number, number, number, number, number, number], h: number, iters = 3) {
  const [X0, Y0, Z0] = [bnd[0], bnd[2], bnd[4]];
  const nx = Math.ceil((bnd[1] - X0) / h) + 1, ny = Math.ceil((bnd[3] - Y0) / h) + 1, nz = Math.ceil((bnd[5] - Z0) / h) + 1;
  const sxy = nx * ny;
  const grid = new Float32Array(nx * ny * nz).fill(1);
  for (const p of prims) {
    const m = p.k + 2.5 * h;
    const i0 = Math.max(0, Math.floor((p.lo[0] - m - X0) / h)), i1 = Math.min(nx - 1, Math.ceil((p.hi[0] + m - X0) / h));
    const j0 = Math.max(0, Math.floor((p.lo[1] - m - Y0) / h)), j1 = Math.min(ny - 1, Math.ceil((p.hi[1] + m - Y0) / h));
    const k0 = Math.max(0, Math.floor((p.lo[2] - m - Z0) / h)), k1 = Math.min(nz - 1, Math.ceil((p.hi[2] + m - Z0) / h));
    for (let k = k0; k <= k1; k++) {
      const z = Z0 + k * h;
      for (let j = j0; j <= j1; j++) {
        const y = Y0 + j * h;
        let o = i0 + j * nx + k * sxy;
        for (let i = i0; i <= i1; i++, o++) grid[o] = smin(grid[o], p.f(X0 + i * h, y, z), p.k);
      }
    }
  }

  // Surface Nets
  const cnx = nx - 1, cny = ny - 1;
  const vid = new Int32Array(cnx * cny * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + j * cnx + k * cnx * cny;
  const pos: number[] = [];
  const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const OFF = C.map(([a, b, c]) => a + b * nx + c * sxy);
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const o = i + j * nx + k * sxy;
    if (grid[o] > 4 * h || grid[o] < -4 * h) continue;
    let neg = 0;
    for (let c = 0; c < 8; c++) { v[c] = grid[o + OFF[c]]; if (v[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let ax = 0, ay = 0, az = 0, n = 0;
    for (const [a, b] of E) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      ax += C[a][0] + (C[b][0] - C[a][0]) * t; ay += C[a][1] + (C[b][1] - C[a][1]) * t; az += C[a][2] + (C[b][2] - C[a][2]) * t; n++;
    }
    vid[cidx(i, j, k)] = pos.length / 3;
    pos.push(X0 + (i + ax / n) * h, Y0 + (j + ay / n) * h, Z0 + (k + az / n) * h);
  }
  const tris: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tris.push(a, d, c, a, c, b); else tris.push(a, b, c, a, c, d);
  };
  const g = (i: number, j: number, k: number) => grid[i + j * nx + k * sxy];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    if (vid[cidx(i, j, k)] < 0) continue;
    const g0 = g(i, j, k) < 0;
    if (g0 !== g(i + 1, j, k) < 0) quad(vid[cidx(i, j - 1, k - 1)], vid[cidx(i, j, k - 1)], vid[cidx(i, j, k)], vid[cidx(i, j - 1, k)], !g0);
    if (g0 !== g(i, j + 1, k) < 0) quad(vid[cidx(i - 1, j, k - 1)], vid[cidx(i - 1, j, k)], vid[cidx(i, j, k)], vid[cidx(i, j, k - 1)], !g0);
    if (g0 !== g(i, j, k + 1) < 0) quad(vid[cidx(i - 1, j - 1, k)], vid[cidx(i, j - 1, k)], vid[cidx(i, j, k)], vid[cidx(i - 1, j, k)], !g0);
  }

  // هموارسازی تاوبین
  const nv = pos.length / 3;
  const adj: number[][] = Array.from({ length: nv }, () => []);
  const link = (a: number, b: number) => { if (!adj[a].includes(b)) adj[a].push(b); };
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    link(a, b); link(b, a); link(b, c); link(c, b); link(a, c); link(c, a);
  }
  const tmp = new Float32Array(pos.length);
  const pass = (lam: number) => {
    for (let q = 0; q < nv; q++) {
      const nb = adj[q];
      if (!nb.length) { tmp[q * 3] = pos[q * 3]; tmp[q * 3 + 1] = pos[q * 3 + 1]; tmp[q * 3 + 2] = pos[q * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (const o of nb) { sx += pos[o * 3]; sy += pos[o * 3 + 1]; sz += pos[o * 3 + 2]; }
      const mm = 1 / nb.length;
      tmp[q * 3] = pos[q * 3] + lam * (sx * mm - pos[q * 3]);
      tmp[q * 3 + 1] = pos[q * 3 + 1] + lam * (sy * mm - pos[q * 3 + 1]);
      tmp[q * 3 + 2] = pos[q * 3 + 2] + lam * (sz * mm - pos[q * 3 + 2]);
    }
    for (let q = 0; q < pos.length; q++) pos[q] = tmp[q];
  };
  for (let it = 0; it < iters; it++) { pass(0.5); pass(-0.53); }

  return { pos, tris };
}

