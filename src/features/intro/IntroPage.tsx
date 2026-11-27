import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadIndex, type BookSummary } from "@/lib/content";
import { toFa } from "@/lib/fa";
import { BookCover } from "@/components/BookCover";

/** پیش‌درآمد: معرفی برنامه و فهرست کتاب‌ها. */
export function IntroPage() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIndex()
      .then((i) => setBooks(i.books))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">کتاب‌های درسی تعاملی</h1>
        <p className="mt-3 max-w-2xl text-brand-100">
          مفاهیم درسی را فقط نخوانید؛ بچرخانید، بزرگ کنید و لمس کنید. همه‌چیز بعد از اولین بارگذاری بدون اینترنت هم در دسترس است.
        </p>
      </section>

      <section aria-labelledby="books-title">
        <h2 id="books-title" className="mb-4 text-xl font-bold">کتاب‌ها</h2>

        {error && <p role="alert" className="text-red-600">{error}</p>}
        {!books && !error && <p>در حال بارگذاری…</p>}
        {books && books.length === 0 && <p>هنوز کتابی اضافه نشده است.</p>}

        {books && books.length > 0 && (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/book/${b.id}`}
                  className="group block rounded-2xl p-2 transition hover:-translate-y-1 hover:bg-white hover:shadow-md dark:hover:bg-slate-900"
                  aria-label={`${b.title} ${b.gradeLabel}`}
                >
                  <BookCover title={b.title} grade={b.grade} subject={b.subject} />
                  <div className="mt-3 px-1">
                    <h3 className="font-semibold">{b.title} {b.gradeLabel}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {b.level} · {toFa(b.chapterCount)} فصل
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
