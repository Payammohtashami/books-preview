/** داده‌ی ۱۱۸ عنصر جدول تناوبی (برای استفاده‌ی مشترک در درس‌ها و جدول مندلیف). */

export type Category =
  | "alkali"
  | "alkaline"
  | "transition"
  | "post"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble"
  | "lanthanide"
  | "actinide";

export type MatterState = "gas" | "liquid" | "solid" | "unknown";

export interface ChemElement {
  z: number;
  symbol: string;
  fa: string;
  en: string;
  /** جرم اتمی میانگین (برای عنصرهای پرتوزا، عدد جرمی پایدارترین ایزوتوپ) */
  mass: number;
  category: Category;
  /** گروه ۱ تا ۱۸؛ برای لانتانیدها و آکتینیدها undefined */
  group?: number;
  period: number;
  state: MatterState;
  /** تعداد الکترون در هر لایه */
  shells: number[];
}

export const CATEGORY: Record<Category, { fa: string; color: string }> = {
  alkali: { fa: "فلز قلیایی", color: "#ef4444" },
  alkaline: { fa: "فلز قلیایی خاکی", color: "#f97316" },
  transition: { fa: "فلز واسطه", color: "#eab308" },
  post: { fa: "فلز پس از واسطه", color: "#14b8a6" },
  metalloid: { fa: "شبه‌فلز", color: "#06b6d4" },
  nonmetal: { fa: "نافلز", color: "#22c55e" },
  halogen: { fa: "هالوژن", color: "#3b82f6" },
  noble: { fa: "گاز نجیب", color: "#8b5cf6" },
  lanthanide: { fa: "لانتانید", color: "#ec4899" },
  actinide: { fa: "آکتینید", color: "#a855f7" },
};

export const STATE_FA: Record<MatterState, string> = {
  gas: "گاز",
  liquid: "مایع",
  solid: "جامد",
  unknown: "نامشخص",
};

// [نشانه، نام فارسی، نام انگلیسی، جرم]
const RAW: [string, string, string, number][] = [
  ["H", "هیدروژن", "Hydrogen", 1.008], ["He", "هلیم", "Helium", 4.0026],
  ["Li", "لیتیم", "Lithium", 6.94], ["Be", "بریلیم", "Beryllium", 9.0122], ["B", "بور", "Boron", 10.81],
  ["C", "کربن", "Carbon", 12.011], ["N", "نیتروژن", "Nitrogen", 14.007], ["O", "اکسیژن", "Oxygen", 15.999],
  ["F", "فلوئور", "Fluorine", 18.998], ["Ne", "نئون", "Neon", 20.18],
  ["Na", "سدیم", "Sodium", 22.99], ["Mg", "منیزیم", "Magnesium", 24.305], ["Al", "آلومینیم", "Aluminium", 26.982],
  ["Si", "سیلیسیم", "Silicon", 28.085], ["P", "فسفر", "Phosphorus", 30.974], ["S", "گوگرد", "Sulfur", 32.06],
  ["Cl", "کلر", "Chlorine", 35.45], ["Ar", "آرگون", "Argon", 39.948],
  ["K", "پتاسیم", "Potassium", 39.098], ["Ca", "کلسیم", "Calcium", 40.078], ["Sc", "اسکاندیم", "Scandium", 44.956],
  ["Ti", "تیتانیم", "Titanium", 47.867], ["V", "وانادیم", "Vanadium", 50.942], ["Cr", "کروم", "Chromium", 51.996],
  ["Mn", "منگنز", "Manganese", 54.938], ["Fe", "آهن", "Iron", 55.845], ["Co", "کبالت", "Cobalt", 58.933],
  ["Ni", "نیکل", "Nickel", 58.693], ["Cu", "مس", "Copper", 63.546], ["Zn", "روی", "Zinc", 65.38],
  ["Ga", "گالیم", "Gallium", 69.723], ["Ge", "ژرمانیم", "Germanium", 72.63], ["As", "آرسنیک", "Arsenic", 74.922],
  ["Se", "سلنیم", "Selenium", 78.971], ["Br", "برم", "Bromine", 79.904], ["Kr", "کریپتون", "Krypton", 83.798],
  ["Rb", "روبیدیم", "Rubidium", 85.468], ["Sr", "استرانسیم", "Strontium", 87.62], ["Y", "ایتریم", "Yttrium", 88.906],
  ["Zr", "زیرکونیم", "Zirconium", 91.224], ["Nb", "نیوبیم", "Niobium", 92.906], ["Mo", "مولیبدن", "Molybdenum", 95.95],
  ["Tc", "تکنسیم", "Technetium", 98], ["Ru", "روتنیم", "Ruthenium", 101.07], ["Rh", "رودیم", "Rhodium", 102.91],
  ["Pd", "پالادیم", "Palladium", 106.42], ["Ag", "نقره", "Silver", 107.87], ["Cd", "کادمیم", "Cadmium", 112.41],
  ["In", "ایندیم", "Indium", 114.82], ["Sn", "قلع", "Tin", 118.71], ["Sb", "آنتیموان", "Antimony", 121.76],
  ["Te", "تلوریم", "Tellurium", 127.6], ["I", "ید", "Iodine", 126.9], ["Xe", "زنون", "Xenon", 131.29],
  ["Cs", "سزیم", "Caesium", 132.91], ["Ba", "باریم", "Barium", 137.33], ["La", "لانتان", "Lanthanum", 138.91],
  ["Ce", "سریم", "Cerium", 140.12], ["Pr", "پرازئودیمیم", "Praseodymium", 140.91], ["Nd", "نئودیمیم", "Neodymium", 144.24],
  ["Pm", "پرومتیم", "Promethium", 145], ["Sm", "ساماریم", "Samarium", 150.36], ["Eu", "یوروپیم", "Europium", 151.96],
  ["Gd", "گادولینیم", "Gadolinium", 157.25], ["Tb", "تربیم", "Terbium", 158.93], ["Dy", "دیسپروزیم", "Dysprosium", 162.5],
  ["Ho", "هولمیم", "Holmium", 164.93], ["Er", "اربیم", "Erbium", 167.26], ["Tm", "تولیم", "Thulium", 168.93],
  ["Yb", "ایتربیم", "Ytterbium", 173.05], ["Lu", "لوتسیم", "Lutetium", 174.97],
  ["Hf", "هافنیم", "Hafnium", 178.49], ["Ta", "تانتال", "Tantalum", 180.95], ["W", "تنگستن", "Tungsten", 183.84],
  ["Re", "رنیم", "Rhenium", 186.21], ["Os", "اسمیم", "Osmium", 190.23], ["Ir", "ایریدیم", "Iridium", 192.22],
  ["Pt", "پلاتین", "Platinum", 195.08], ["Au", "طلا", "Gold", 196.97], ["Hg", "جیوه", "Mercury", 200.59],
  ["Tl", "تالیم", "Thallium", 204.38], ["Pb", "سرب", "Lead", 207.2], ["Bi", "بیسموت", "Bismuth", 208.98],
  ["Po", "پولونیم", "Polonium", 209], ["At", "آستاتین", "Astatine", 210], ["Rn", "رادون", "Radon", 222],
  ["Fr", "فرانسیم", "Francium", 223], ["Ra", "رادیم", "Radium", 226], ["Ac", "آکتینیم", "Actinium", 227],
  ["Th", "توریم", "Thorium", 232.04], ["Pa", "پروتاکتینیم", "Protactinium", 231.04], ["U", "اورانیم", "Uranium", 238.03],
  ["Np", "نپتونیم", "Neptunium", 237], ["Pu", "پلوتونیم", "Plutonium", 244], ["Am", "آمریسیم", "Americium", 243],
  ["Cm", "کوریم", "Curium", 247], ["Bk", "برکلیم", "Berkelium", 247], ["Cf", "کالیفرنیم", "Californium", 251],
  ["Es", "اینشتینیم", "Einsteinium", 252], ["Fm", "فرمیم", "Fermium", 257], ["Md", "مندلیویم", "Mendelevium", 258],
  ["No", "نوبلیم", "Nobelium", 259], ["Lr", "لورنسیم", "Lawrencium", 266],
  ["Rf", "رادرفوردیم", "Rutherfordium", 267], ["Db", "دوبنیم", "Dubnium", 268], ["Sg", "سیبورگیم", "Seaborgium", 269],
  ["Bh", "بوریم", "Bohrium", 270], ["Hs", "هاسیم", "Hassium", 277], ["Mt", "مایتنریم", "Meitnerium", 278],
  ["Ds", "دارمشتادیم", "Darmstadtium", 281], ["Rg", "رونتگنیم", "Roentgenium", 282], ["Cn", "کوپرنیسیم", "Copernicium", 285],
  ["Nh", "نیهونیم", "Nihonium", 286], ["Fl", "فلروویم", "Flerovium", 289], ["Mc", "مسکویم", "Moscovium", 290],
  ["Lv", "لیورموریم", "Livermorium", 293], ["Ts", "تنسین", "Tennessine", 294], ["Og", "اوگانسون", "Oganesson", 294],
];

const ALKALI = [3, 11, 19, 37, 55, 87];
const ALKALINE = [4, 12, 20, 38, 56, 88];
const METALLOID = [5, 14, 32, 33, 51, 52];
const NONMETAL = [1, 6, 7, 8, 15, 16, 34];
const HALOGEN = [9, 17, 35, 53, 85, 117];
const NOBLE = [2, 10, 18, 36, 54, 86, 118];
const POST = [13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116];
const GAS = [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86];
const LIQUID = [35, 80];
const UNKNOWN_STATE = [85, 87, ...Array.from({ length: 15 }, (_, i) => 104 + i)];

function categoryOf(z: number): Category {
  if (ALKALI.includes(z)) return "alkali";
  if (ALKALINE.includes(z)) return "alkaline";
  if (METALLOID.includes(z)) return "metalloid";
  if (NONMETAL.includes(z)) return "nonmetal";
  if (HALOGEN.includes(z)) return "halogen";
  if (NOBLE.includes(z)) return "noble";
  if (POST.includes(z)) return "post";
  if (z >= 57 && z <= 71) return "lanthanide";
  if (z >= 89 && z <= 103) return "actinide";
  return "transition";
}

function groupPeriod(z: number): { group?: number; period: number } {
  if (z === 1) return { group: 1, period: 1 };
  if (z === 2) return { group: 18, period: 1 };
  if (z <= 4) return { group: z - 2, period: 2 };
  if (z <= 10) return { group: z + 8, period: 2 };
  if (z <= 12) return { group: z - 10, period: 3 };
  if (z <= 18) return { group: z, period: 3 };
  if (z <= 36) return { group: z - 18, period: 4 };
  if (z <= 54) return { group: z - 36, period: 5 };
  if (z <= 56) return { group: z - 54, period: 6 };
  if (z <= 71) return { period: 6 };
  if (z <= 86) return { group: z - 68, period: 6 };
  if (z <= 88) return { group: z - 86, period: 7 };
  if (z <= 103) return { period: 7 };
  return { group: z - 100, period: 7 };
}

// پرکردن زیرلایه‌ها به ترتیب آفبا
const ORDER: [number, number][] = [
  [1, 2], [2, 2], [2, 6], [3, 2], [3, 6], [4, 2], [3, 10], [4, 6], [5, 2], [4, 10], [5, 6], [6, 2],
  [4, 14], [5, 10], [6, 6], [7, 2], [5, 14], [6, 10], [7, 6],
];
// استثناهای آفبا (آرایش لایه‌ای واقعی)
const EXCEPT: Record<number, number[]> = {
  24: [2, 8, 13, 1], 29: [2, 8, 18, 1], 41: [2, 8, 18, 12, 1], 42: [2, 8, 18, 13, 1],
  44: [2, 8, 18, 15, 1], 45: [2, 8, 18, 16, 1], 46: [2, 8, 18, 18], 47: [2, 8, 18, 18, 1],
  57: [2, 8, 18, 18, 9, 2], 58: [2, 8, 18, 19, 9, 2], 64: [2, 8, 18, 25, 9, 2],
  78: [2, 8, 18, 32, 17, 1], 79: [2, 8, 18, 32, 18, 1],
  89: [2, 8, 18, 32, 18, 9, 2], 90: [2, 8, 18, 32, 18, 10, 2], 91: [2, 8, 18, 32, 20, 9, 2],
  92: [2, 8, 18, 32, 21, 9, 2], 93: [2, 8, 18, 32, 22, 9, 2], 96: [2, 8, 18, 32, 25, 9, 2],
  103: [2, 8, 18, 32, 32, 8, 3],
};

function shellsOf(z: number): number[] {
  if (EXCEPT[z]) return EXCEPT[z];
  const out: number[] = [];
  let left = z;
  for (const [n, cap] of ORDER) {
    if (left <= 0) break;
    const k = Math.min(cap, left);
    out[n - 1] = (out[n - 1] ?? 0) + k;
    left -= k;
  }
  return out.map((v) => v ?? 0);
}

export const ELEMENT_LIST: ChemElement[] = RAW.map(([symbol, fa, en, mass], i) => {
  const z = i + 1;
  return {
    z,
    symbol,
    fa,
    en,
    mass,
    category: categoryOf(z),
    ...groupPeriod(z),
    state: UNKNOWN_STATE.includes(z) ? "unknown" : GAS.includes(z) ? "gas" : LIQUID.includes(z) ? "liquid" : "solid",
    shells: shellsOf(z),
  } as ChemElement;
});

export const elementByZ = (z: number): ChemElement | undefined => ELEMENT_LIST[z - 1];
export const elementBySymbol = (s: string): ChemElement | undefined => ELEMENT_LIST.find((e) => e.symbol === s);

/** موقعیت خانه در شبکه‌ی ۱۸ ستونی (ردیف ۸ فاصله و ردیف‌های ۹ و ۱۰ لانتانیدها و آکتینیدها) */
export function gridPos(e: ChemElement): { col: number; row: number } {
  if (e.group) return { col: e.group, row: e.period };
  if (e.z >= 57 && e.z <= 71) return { col: e.z - 57 + 3, row: 9 };
  return { col: e.z - 89 + 3, row: 10 };
}
