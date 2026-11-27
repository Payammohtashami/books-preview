import { bookBase, type Book } from "./content";

/** متن درون‌خطی: **پررنگ** و نمادهای شیمیایی {نماد:عدد‌جرمی:عدد‌اتمی} مثل {C:12:6} */
export type Inline = string;

export type CalloutKind = "discuss" | "didYouKnow" | "activity" | "think" | "selfCheck" | "safety" | "research";

export interface QuizQuestion {
  q: Inline;
  options: Inline[];
  answer: number;
  explanation: Inline;
}

export type Block =
  | { type: "p"; text: Inline }
  | { type: "table"; caption?: Inline; head: Inline[]; rows: Inline[][] }
  | { type: "callout"; kind: CalloutKind; text?: Inline; items?: Inline[]; answer?: Inline[]; extras?: Block[] }
  | { type: "figure"; image: string; alt: string; caption?: Inline; compact?: boolean }
  | { type: "gallery"; caption?: Inline; items: { image: string; alt: string; caption: Inline }[] }
  | { type: "elementsGrid"; caption?: Inline }
  | { type: "atomCards"; caption?: Inline }
  | { type: "bohrFigure"; caption?: Inline; atoms: { label: string; p: number; n: number; e?: number }[] }
  | { type: "atomChoice"; caption?: Inline; options: { label: string; p: number; n: number; e?: number; correct?: boolean; why: string }[] }
  | { type: "isotopeFigure"; image: string; caption?: Inline }
  | { type: "coalIsotopes"; image: string; caption?: Inline }
  | { type: "naclReaction"; caption?: Inline }
  | { type: "radioactivity"; caption?: Inline }
  | { type: "nervousBody"; text?: string; heading?: string; text2?: string; caption?: Inline }
  | { type: "brainExplorer"; caption?: Inline }
  | { type: "neuronFigure"; caption?: Inline }
  | { type: "reflexArc"; caption?: Inline }
  | { type: "spinalSection"; caption?: Inline }
  | { type: "isotopeCompare"; caption?: Inline }
  | { type: "periodicTable"; caption?: Inline; highlight?: number[]; title?: string }
  | { type: "atom"; caption?: Inline; initial: string; elements: string[]; ions?: boolean }
  | { type: "quiz"; title: string; questions: QuizQuestion[] };

export interface LessonSection {
  id: string;
  title: string;
  /** عنوان قبلاً کنار یک شکل نمایش داده شده است */
  hideTitle?: boolean;
  blocks: Block[];
}

export interface Lesson {
  schemaVersion: 1;
  chapter: number;
  title: string;
  intro: Inline;
  hero: { image: string; alt: string };
  sections: LessonSection[];
}

export async function loadLesson(book: Book, chapterNumber: number): Promise<Lesson> {
  const ch = book.chapters.find((c) => c.number === chapterNumber);
  if (!ch?.lesson) throw new Error("برای این فصل هنوز درس تعاملی ساخته نشده است");
  const res = await fetch(`${bookBase(book.id)}/${ch.lesson}`);
  if (!res.ok) throw new Error("درس بارگذاری نشد");
  return res.json();
}

/** آدرس تصویر نسبت به پوشه‌ی درس */
export const lessonAsset = (book: Book, chapter: { lesson?: string }, file: string) => {
  const dir = (chapter.lesson ?? "").split("/").slice(0, -1).join("/");
  return `${bookBase(book.id)}/${dir}/${file}`;
};
