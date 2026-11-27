import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadBook, type Book } from "@/lib/content";
import { lessonAsset, loadLesson, type Lesson } from "@/lib/lesson";
import { toFa } from "@/lib/fa";
import { ModeTabs } from "@/components/ModeTabs";
import { AssetContext, BlockView } from "./Blocks";
import { Inline } from "./Inline";
import { BookOpen, ChevronLeft, ChevronsLeft } from "lucide-react";

/** حالت «درس تعاملی»: متن و تصویرهای کتاب با ظاهر بهتر، به‌همراه مدل‌های سه‌بعدی. */
export function LessonPage() {
  const { bookId = "", chapter: chapterParam = "" } = useParams();
  const chapterNo = Number(chapterParam);
  const [book, setBook] = useState<Book | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBook(null); setLesson(null); setError(null);
    loadBook(bookId)
      .then(async (b) => {
        setBook(b);
        setLesson(await loadLesson(b, chapterNo));
      })
      .catch((e: Error) => setError(e.message));
  }, [bookId, chapterNo]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [chapterNo]);

  if (error)
    return (
      <div className="space-y-3">
        <p role="alert" className="text-red-600">{error}</p>
        <Link to={`/book/${bookId}`} className="text-brand-700 underline dark:text-brand-500">بازگشت به فصل‌ها</Link>
      </div>
    );
  if (!book || !lesson) return <p>در حال بارگذاری درس…</p>;

  const chapter = book.chapters.find((c) => c.number === chapterNo)!;
  const asset = (file: string) => lessonAsset(book, chapter, file);

  return (
    <AssetContext.Provider value={asset}>
      <div className="space-y-6">
        <nav aria-label="مسیر" className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            <Link to="/" className="hover:underline">کتاب‌ها</Link>
            <ChevronLeft className="mx-1 inline size-4 align-[-0.2em]" aria-hidden="true" />
            <Link to={`/book/${book.id}`} className="hover:underline">{book.title} {book.gradeLabel}</Link>
            <ChevronLeft className="mx-1 inline size-4 align-[-0.2em]" aria-hidden="true" />
            <span>فصل {toFa(chapter.number)}</span>
          </div>
          <ModeTabs book={book} chapter={chapter} active="lesson" />
        </nav>

        <header className="relative overflow-hidden rounded-3xl bg-slate-900 text-white">
          <img src={asset(lesson.hero.image)} alt={lesson.hero.alt} className="absolute inset-0 size-full object-cover opacity-60" />
          <div className="relative bg-gradient-to-t from-black/80 via-black/30 to-transparent px-5 pb-7 pt-28 sm:px-6 sm:pb-8 sm:pt-40">
            <p className="mb-1 inline-block rounded bg-yellow-400 px-3 py-0.5 text-sm font-bold text-slate-900">فصل {toFa(chapter.number)}</p>
            <h1 className="text-2xl font-extrabold sm:text-4xl">{lesson.title}</h1>
            <p className="mt-3 max-w-3xl text-slate-100 max-sm:text-[15px]"><Inline text={lesson.intro} /></p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
          <aside className="hidden lg:block">
            <nav aria-label="فهرست درس" className="sticky top-20 space-y-1 text-sm">
              <p className="mb-2 font-bold">در این درس</p>
              {lesson.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">{s.title}</a>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 space-y-10 max-sm:text-[15px]">
            {lesson.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-20 space-y-5">
                <h2 id={`${s.id}-t`} className={s.hideTitle ? "sr-only" : "flex items-center gap-2 text-xl font-bold sm:text-2xl text-brand-700 dark:text-brand-500"}>
                  <ChevronsLeft className="size-6 shrink-0 text-orange-500" aria-hidden="true" /> {s.title}
                </h2>
                {s.blocks.map((b, i) => <BlockView key={i} block={b} />)}
              </section>
            ))}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Link to={`/book/${book.id}/read/${chapter.startPage}`} className="inline-flex items-center gap-2 text-brand-700 underline dark:text-brand-500">
                <BookOpen className="size-4" aria-hidden="true" /> دیدن همین فصل در خود کتاب (صفحه‌ی {toFa(chapter.startPage)})
              </Link>
              <Link to={`/book/${book.id}`} className="text-slate-600 underline dark:text-slate-400">فهرست فصل‌ها</Link>
            </footer>
          </article>
        </div>
      </div>
    </AssetContext.Provider>
  );
}
