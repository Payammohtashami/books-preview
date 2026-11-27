import type { Subject } from "@/lib/content";
import { toFa } from "@/lib/fa";
import { BookOpen, FlaskConical, Ruler, type LucideIcon } from "lucide-react";

const palettes: Record<Subject, string> = {
  science: "from-teal-500 via-emerald-600 to-cyan-700",
  math: "from-indigo-500 via-violet-600 to-fuchsia-700",
  other: "from-slate-500 via-slate-600 to-slate-800",
};

const icons: Record<Subject, LucideIcon> = { science: FlaskConical, math: Ruler, other: BookOpen };

/** جلد تولیدشده برای کتاب (بدون استفاده از تصویر کتاب). */
export function BookCover({ title, grade, subject, className = "" }: { title: string; grade: number; subject: Subject; className?: string }) {
  const Icon = icons[subject];
  return (
    <div
      className={`relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg ${palettes[subject]} ${className}`}
      aria-hidden="true"
    >
      <div className="absolute -start-6 -top-6 size-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -end-8 size-36 rounded-full bg-white/10" />
      <Icon className="relative size-10 drop-shadow" strokeWidth={1.75} aria-hidden="true" />
      <div className="relative">
        <p className="text-sm opacity-90">پایه‌ی {toFa(grade)}</p>
        <p className="text-2xl font-extrabold leading-tight">{title}</p>
      </div>
    </div>
  );
}
