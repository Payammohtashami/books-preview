import { lazy, Suspense } from "react";
import { Route, Routes, Link } from "react-router-dom";
import { Layout } from "@/app/Layout";
import { IntroPage } from "@/features/intro/IntroPage";
import { BookPage } from "@/features/book/BookPage";

// Three.js سنگین است؛ فقط هنگام نیاز بارگذاری می‌شود.
const ViewerPage = lazy(() => import("@/features/viewer3d/ViewerPage"));
const ReaderPage = lazy(() => import("@/features/reader/ReaderPage").then((m) => ({ default: m.ReaderPage })));
const LessonPage = lazy(() => import("@/features/lesson/LessonPage").then((m) => ({ default: m.LessonPage })));

const Loading = <p role="status">در حال بارگذاری…</p>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<IntroPage />} />
        <Route path="book/:bookId" element={<BookPage />} />
        <Route path="book/:bookId/read/:page?" element={<Suspense fallback={Loading}><ReaderPage /></Suspense>} />
        <Route path="book/:bookId/lesson/:chapter" element={<Suspense fallback={Loading}><LessonPage /></Suspense>} />
        <Route
          path="viewer"
          element={
            <Suspense fallback={<p>در حال بارگذاری نمایشگر…</p>}>
              <ViewerPage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <p>
              صفحه پیدا نشد. <Link className="text-brand-700 underline" to="/">بازگشت</Link>
            </p>
          }
        />
      </Route>
    </Routes>
  );
}
