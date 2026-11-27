import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadBook, type Book } from "@/lib/content";
import { toFa } from "@/lib/fa";
import { BookCover } from "@/components/BookCover";
import { BookOpen, ChevronLeft, Sparkles } from "lucide-react";

/** صفحه‌ی یک کتاب: اطلاعات و فهرست فصل‌ها. */
export function BookPage() {
  const { bookId = "" } = useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBook(null);
    setError(null);
    loadBook(bookId).then(setBook).catch((e: Error) => setError(e.message));
  }, [bookId]);

  if (error)
    return (
      <div className="space-y-3">
        <p role="alert" className="text-red-600">{error}</p>
        <Link to="/" className="text-brand-700 underline dark:text-brand-500">بازگشت به کتاب‌ها</Link>
      </div>
    );
  if (!book) return <p>در حال بارگذاری…</p>;

  return (
    <div className="space-y-8">
      <nav aria-label="مسیر" className="text-sm text-slate-500">
        <Link to="/" className="hover:underline">کتاب‌ها</Link>
        <ChevronLeft className="mx-1 inline size-4 align-[-0.2em]" aria-hidden="true" />
        <span>{book.title} {book.gradeLabel}</span>
      </nav>

      <header className="flex flex-col items-start gap-6 sm:flex-row">
        <BookCover title={book.title} grade={book.grade} subject={book.subject} className="w-40 shrink-0" />
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold">{book.title} {book.gradeLabel}</h1>
          <p className="text-slate-600 dark:text-slate-400">
            {book.level} · {toFa(book.chapters.length)} فصل · {toFa(book.totalPages)} صفحه
          </p>
          <Link
            to={`/book/${book.id}/read/${book.chapters[0]?.startPage ?? 1}`}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2 font-medium text-white hover:bg-brand-600"
          >
            <BookOpen className="size-4" aria-hidden="true" /> شروع مطالعه
          </Link>
        </div>
      </header>

      <section aria-labelledby="chapters-title">
        <h2 id="chapters-title" className="mb-3 text-xl font-bold">فصل‌ها</h2>
        <ol className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {book.chapters.map((c) => (
            <li key={c.number} className="flex items-center">
              <Link
                to={`/book/${book.id}/read/${c.startPage}`}
                className="flex flex-1 items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-100">
                  {toFa(c.number)}
                </span>
                <span className="flex-1 font-medium">{c.title}</span>
                <span className="hidden text-sm text-slate-500 sm:inline">صفحه‌ی {toFa(c.startPage)}</span>
                <ChevronLeft className="size-4 text-slate-400" aria-hidden="true" />
              </Link>
              {c.lesson && (
                <Link
                  to={`/book/${book.id}/lesson/${c.number}`}
                  className="me-3 inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600"
                >
                  <Sparkles className="size-4" aria-hidden="true" /> درس تعاملی
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
