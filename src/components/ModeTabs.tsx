import { Link } from "react-router-dom";
import type { Book, Chapter } from "@/lib/content";
import { BookOpen, Sparkles } from "lucide-react";

/** سوییچ بین «کتاب» (PDF اصلی) و «درس تعاملی» (بازطراحی‌شده). */
export function ModeTabs({ book, chapter, active, page }: { book: Book; chapter?: Chapter; active: "book" | "lesson"; page?: number }) {
  const hasLesson = Boolean(chapter?.lesson);
  const base = "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition";
  const on = "bg-brand-700 text-white shadow";
  const off = "text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    <div role="tablist" aria-label="حالت نمایش" className="inline-flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      <Link
        role="tab"
        aria-selected={active === "book"}
        to={`/book/${book.id}/read/${active === "book" ? (page ?? 1) : (chapter?.startPage ?? 1)}`}
        className={`${base} ${active === "book" ? on : off}`}
      >
        <BookOpen className="size-4" aria-hidden="true" /> کتاب
      </Link>
      {hasLesson && chapter ? (
        <Link
          role="tab"
          aria-selected={active === "lesson"}
          to={`/book/${book.id}/lesson/${chapter.number}`}
          className={`${base} ${active === "lesson" ? on : off}`}
        >
          <Sparkles className="size-4" aria-hidden="true" /> درس تعاملی
        </Link>
      ) : (
        <span
          role="tab"
          aria-selected={false}
          aria-disabled="true"
          title="برای این بخش هنوز درس تعاملی ساخته نشده است"
          className={`${base} cursor-not-allowed text-slate-400 dark:text-slate-600`}
        >
          <Sparkles className="size-4" aria-hidden="true" /> درس تعاملی
        </span>
      )}
    </div>
  );
}
