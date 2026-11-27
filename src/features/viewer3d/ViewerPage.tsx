import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Environment } from "@react-three/drei";
import { useState } from "react";

const parts = [
  { name: "هسته", color: "#6366f1", pos: [0, 0, 0] as const, r: 0.5 },
  { name: "هاله‌ی بیرونی", color: "#14b8a6", pos: [1.4, 0.4, 0] as const, r: 0.28 },
  { name: "ماهواره", color: "#f59e0b", pos: [-1.2, -0.3, 0.6] as const, r: 0.2 },
];

/** نمایشگر آزمایشی: فقط برای اثبات کارکرد Three.js و کنترل لمسی. مدل واقعی مرحله‌ی ۳ است. */
export default function ViewerPage() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">نمایشگر سه‌بعدی (آزمایشی)</h1>
      <p className="mb-4 text-slate-600 dark:text-slate-400">با انگشت یا ماوس بچرخانید؛ با دو انگشت یا چرخ ماوس بزرگ‌نمایی کنید.</p>
      <div className="h-[60dvh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.8, 4], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 2]} intensity={1.2} />
          <Environment preset="city" />
          {parts.map((p) => (
            <mesh key={p.name} position={p.pos} onClick={(e) => { e.stopPropagation(); setActive(p.name); }}>
              <sphereGeometry args={[p.r, 48, 48]} />
              <meshStandardMaterial color={p.color} emissive={active === p.name ? p.color : "#000"} emissiveIntensity={0.4} />
              <Html center distanceFactor={8} position={[0, p.r + 0.2, 0]}>
                <span className="whitespace-nowrap rounded bg-white/90 px-2 py-0.5 text-xs text-slate-900 shadow">{p.name}</span>
              </Html>
            </mesh>
          ))}
          <OrbitControls enablePan={false} minDistance={2} maxDistance={8} makeDefault />
        </Canvas>
      </div>
      <p className="mt-3 min-h-8 text-slate-700 dark:text-slate-300">{active ? `انتخاب‌شده: ${active}` : "یک بخش را لمس کنید."}</p>
    </section>
  );
}
