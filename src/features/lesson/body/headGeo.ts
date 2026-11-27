import * as THREE from "three";
import { capsule, ellip, sdfMesh, type Prim } from "./sdf";

/** سر و گردن از نیمرخ (رو به +x) در دستگاه مختصات مغز؛ یک پوست یک‌تکه و هموار از اجزای ترکیب‌شده */
/** اجزای سر (رو به +x) در دستگاه مختصات مغز؛ با withNeck گردن هم اضافه می‌شود */
export function headPrims(withNeck: boolean): Prim[] {
  const P: Prim[] = [
    ellip([-0.14, 0.14, 0], [1.25, 1.02, 0.94], 0.12),           // جمجمه
    ellip([0.62, -0.42, 0], [0.62, 0.78, 0.66], 0.14),           // صورت
    ellip([0.5, -0.95, 0], [0.5, 0.36, 0.5], 0.14),              // فک
    ellip([0.92, -1.1, 0], [0.26, 0.22, 0.26], 0.1),             // چانه
    ellip([0.98, -0.02, 0], [0.2, 0.1, 0.56], 0.1),              // برجستگی ابرو
    capsule([1.0, -0.1, 0], [1.42, -0.64, 0], 0.125, 0.09, 0.08), // ستون بینی
    ellip([1.42, -0.66, 0], [0.13, 0.1, 0.13], 0.05),            // نوک بینی
    ellip([1.16, -0.84, 0], [0.11, 0.055, 0.2], 0.04),           // لب بالا
    ellip([1.12, -0.98, 0], [0.1, 0.055, 0.17], 0.04),           // لب پایین
    ellip([-0.12, -0.38, 0.93], [0.17, 0.27, 0.06], 0.05),       // گوش‌ها
    ellip([-0.12, -0.38, -0.93], [0.17, 0.27, 0.06], 0.05),
    ellip([0.62, -0.18, 0.3], [0.16, 0.1, 0.1], 0.04),           // اطراف کاسه‌ی چشم
    ellip([0.62, -0.18, -0.3], [0.16, 0.1, 0.1], 0.04),
  ];
  if (withNeck) P.push(capsule([-0.32, -0.9, 0], [-0.42, -3.1, 0], 0.5, 0.46, 0.2, 1.05));
  return P;
}

/** سر و گردن از نیمرخ؛ یک پوست یک‌تکه و هموار */
export function buildProfileHead(): THREE.BufferGeometry {
  const { pos, tris } = sdfMesh(headPrims(true), [-1.75, 1.7, -3.15, 1.4, -1.1, 1.1], 0.028, 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(tris), 1));
  g.computeVertexNormals();
  return g;
}
