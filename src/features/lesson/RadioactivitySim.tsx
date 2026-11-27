import { useState } from "react";
import { Pause, Play } from "lucide-react";

const RAYS = [
  { a: -20, d: 0 }, { a: 35, d: 0.9 }, { a: 100, d: 1.7 }, { a: 160, d: 0.4 }, { a: 215, d: 1.3 }, { a: 280, d: 2.1 },
];
const NUCLEONS = [
  { x: -11, y: -9, p: true },
  { x: 12, y: -5, p: false },
  { x: -1, y: 14, p: false },
];

/** انیمیشن پرتوزایی: هسته‌ی ناپایدار هیدروژن ۳ پیوسته پرتو خارج می‌کند. */
export default function RadioactivitySim() {
  const [on, setOn] = useState(true);
  return (
    <div className="space-y-2 rounded-2xl bg-slate-900 p-3 text-slate-100">
      <svg viewBox="0 0 400 260" className="mx-auto block w-full max-w-xl" role="img" aria-label="هسته‌ی ناپایدار هیدروژن ۳ که پیوسته پرتو خارج می‌کند">
        <defs>
          <radialGradient id="ra-p" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#fecaca" /><stop offset="45%" stopColor="#ef4444" /><stop offset="100%" stopColor="#7f1d1d" /></radialGradient>
          <radialGradient id="ra-n" cx="35%" cy="30%" r="75%"><stop offset="0%" stopColor="#f1f5f9" /><stop offset="45%" stopColor="#94a3b8" /><stop offset="100%" stopColor="#334155" /></radialGradient>
          <radialGradient id="ra-g" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fb923c" stopOpacity="0.6" /><stop offset="100%" stopColor="#fb923c" stopOpacity="0" /></radialGradient>
        </defs>
        <style>{`
          .ra-run{animation-play-state:running}.ra-pause{animation-play-state:paused}
          @keyframes ra-shake{0%,100%{transform:translate(0,0)}20%{transform:translate(1.6px,-1.2px)}40%{transform:translate(-1.4px,1.4px)}60%{transform:translate(1.2px,1.6px)}80%{transform:translate(-1.6px,-1px)}}
          @keyframes ra-glow{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}
          @keyframes ra-ray{0%{transform:translateX(24px);opacity:0}12%{opacity:1}80%{opacity:1}100%{transform:translateX(150px);opacity:0}}
          @media (prefers-reduced-motion: reduce){.ra-m{animation:none!important}}
        `}</style>
        <g transform="translate(200 120)">
          <circle r="62" fill="url(#ra-g)" className={`ra-m ${on ? "ra-run" : "ra-pause"}`} style={{ animation: "ra-glow 1.6s ease-in-out infinite", transformOrigin: "0 0" }} />
          {RAYS.map((r, i) => (
            <g key={i} transform={`rotate(${r.a})`}>
              <g className={`ra-m ${on ? "ra-run" : "ra-pause"}`} style={{ animation: `ra-ray 2.4s ease-out ${r.d}s infinite` }}>
                <line x1="-16" y1="0" x2="0" y2="0" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                <circle r="5" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="1" />
              </g>
            </g>
          ))}
          <g className={`ra-m ${on ? "ra-run" : "ra-pause"}`} style={{ animation: "ra-shake .35s linear infinite" }}>
            {NUCLEONS.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r="11" fill={`url(#${q.p ? "ra-p" : "ra-n"})`} stroke="#0f172a" strokeOpacity="0.35" strokeWidth="0.5" />)}
          </g>
        </g>
        <g fontSize="13" fill="#e2e8f0" textAnchor="middle" style={{ direction: "ltr" }}>
          <text x="200" y="224">هسته‌ی ناپایدار هیدروژن ۳</text>
          <text x="332" y="62" fill="#7dd3fc" fontWeight="700">پرتو</text>
        </g>
      </svg>
      <div className="flex justify-center">
        <button onClick={() => setOn((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
          {on ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
          {on ? "توقف" : "پخش"}
        </button>
      </div>
    </div>
  );
}
