export interface ElementInfo {
  symbol: string;
  name: string;
  z: number;
  /** تعداد نوترون‌های رایج‌ترین ایزوتوپ (مطابق کتاب) */
  n: number;
  /** ایزوتوپ‌های قابل نمایش: عدد جرمی‌ها */
  isotopes?: number[];
}

export const ELEMENTS: Record<string, ElementInfo> = {
  H: { symbol: "H", name: "هیدروژن", z: 1, n: 0, isotopes: [1, 2, 3] },
  He: { symbol: "He", name: "هلیم", z: 2, n: 2 },
  Li: { symbol: "Li", name: "لیتیم", z: 3, n: 4 },
  Be: { symbol: "Be", name: "بریلیم", z: 4, n: 5 },
  B: { symbol: "B", name: "بور", z: 5, n: 6 },
  C: { symbol: "C", name: "کربن", z: 6, n: 6, isotopes: [12, 13, 14] },
  N: { symbol: "N", name: "نیتروژن", z: 7, n: 7 },
  O: { symbol: "O", name: "اکسیژن", z: 8, n: 8 },
  F: { symbol: "F", name: "فلوئور", z: 9, n: 10 },
  Ne: { symbol: "Ne", name: "نئون", z: 10, n: 10 },
  Na: { symbol: "Na", name: "سدیم", z: 11, n: 12 },
  Cl: { symbol: "Cl", name: "کلر", z: 17, n: 18 },
};

/** گنجایش مدارها در مدل بور (برای ۲۰ عنصر اول): ۲، ۸، ۸ */
export const SHELL_CAPACITY = [2, 8, 8];

export function fillShells(electrons: number): number[] {
  const shells: number[] = [];
  let left = electrons;
  for (const cap of SHELL_CAPACITY) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    shells.push(k);
    left -= k;
  }
  return shells;
}

/**
 * مختصات ذره‌های هسته. موقعیت هر ذره فقط به شماره‌ی آن بستگی دارد؛ پس هسته‌ی یک ایزوتوپ سنگین‌تر
 * همان هسته‌ی سبک‌تر است با نوترون‌های اضافه در لبه (baseNeutrons = نوترون‌های سبک‌ترین ایزوتوپ).
 */
export function nucleusLayout(protons: number, neutrons: number, baseNeutrons: number = neutrons) {
  const base = protons + Math.min(baseNeutrons, neutrons);
  const n = protons + neutrons;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const unit = 0.25; // شعاع هر ذره
  const R = n <= 1 ? 0 : unit * Math.cbrt(n) * 1.4;
  const out: { pos: [number, number, number]; proton: boolean; extra: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const r = n <= 1 ? 0 : unit * 1.4 * Math.cbrt(i + 0.5);
    const f = ((i + 0.5) * 0.6180339887498949) % 1;
    const y = 1 - 2 * f;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    const isBase = i < base;
    const proton = isBase && Math.floor(((i + 1) * protons) / base) > Math.floor((i * protons) / base);
    out.push({ pos: [Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r], proton, extra: !isBase });
  }
  return { particles: out, radius: R + unit, unit };
}
