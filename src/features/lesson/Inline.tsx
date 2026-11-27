import { Fragment } from "react";
import { toFa } from "@/lib/fa";

/** نماد هسته‌ای: عدد جرمی بالا، عدد اتمی پایین، سمت چپ نشانه. */
export function Nuclide({ sym, a, z }: { sym: string; a?: string; z?: string }) {
  return (
    <span className="ltr mx-0.5 inline-flex items-center align-middle font-semibold" dir="ltr">
      {(a || z) && (
        <span className="me-0.5 inline-flex flex-col text-[0.62em] leading-[1.1]">
          <span>{a ? toFa(a) : " "}</span>
          <span>{z ? toFa(z) : " "}</span>
        </span>
      )}
      <span>{sym}</span>
    </span>
  );
}

const TOKEN = /(\*\*[^*]+\*\*|\{[A-Za-z]{1,2}:[0-9]*:[0-9]*\}|\{[A-Za-z]{1,2}\^[+-]?[0-9]*\})/g;

/** رندر متن با **پررنگ**، نماد هسته‌ای {C:12:6} و بار یون {Na^+} */
export function Inline({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("{")) {
          const body = part.slice(1, -1);
          if (body.includes("^")) {
            const [sym, charge] = body.split("^");
            return (
              <span key={i} className="ltr mx-0.5 inline-block font-semibold" dir="ltr">
                {sym}
                <sup>{charge.replace("-", "−")}</sup>
              </span>
            );
          }
          const [sym, a, z] = body.split(":");
          return <Nuclide key={i} sym={sym} a={a} z={z} />;
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
