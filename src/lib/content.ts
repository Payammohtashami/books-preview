export type Subject = "science" | "math" | "other";

export interface BookSummary {
  id: string;
  title: string;
  grade: number;
  gradeLabel: string;
  level: string;
  subject: Subject;
  chapterCount: number;
  totalPages: number;
}

export interface Chapter {
  number: number;
  title: string;
  /** شماره‌ی صفحه در فایل PDF (از ۱) */
  startPage: number;
  endPage: number;
  /** مسیر فایل درس تعاملی (نسبت به پوشه‌ی کتاب)، اگر وجود داشته باشد */
  lesson?: string;
}

export interface Book extends Omit<BookSummary, "chapterCount"> {
  schemaVersion: 1;
  pdf: string;
  direction: "rtl" | "ltr";
  /** تفاوت شماره‌ی صفحه‌ی PDF با شماره‌ی چاپی کتاب */
  printedOffset: number;
  chapters: Chapter[];
}

export interface ContentIndex {
  schemaVersion: 1;
  books: BookSummary[];
}

async function getJson<T>(url: string, errorMessage: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(errorMessage);
  return res.json() as Promise<T>;
}

export const loadIndex = () =>
  getJson<ContentIndex>("/content/index.json", "فهرست کتاب‌ها بارگذاری نشد");

export const loadBook = (id: string) =>
  getJson<Book>(`/content/${encodeURIComponent(id)}/book.json`, "این کتاب پیدا نشد");

export const bookBase = (bookId: string) => `/content/${encodeURIComponent(bookId)}`;

export const bookPdfUrl = (book: Pick<Book, "id" | "pdf">) => `${bookBase(book.id)}/${book.pdf}`;

export const chapterForPage = (book: Book, page: number): Chapter | undefined =>
  book.chapters.find((c) => page >= c.startPage && page <= c.endPage);
