import { useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** بومِ سه‌بعدی که فقط وقتی در دید است ساخته می‌شود و خارج از دید رندر نمی‌شود (مناسب موبایل). */
export function LazyCanvas({
  children, camera, label, className = "h-[26rem] md:h-[32rem]", overlay, gl,
}: {
  children: ReactNode;
  camera: { position: [number, number, number]; fov?: number };
  label: string;
  className?: string;
  overlay?: ReactNode;
  gl?: Record<string, unknown>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ever, setEver] = useState(false);
  const [webgl] = useState(hasWebGL);

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setEver(true);
    }, { rootMargin: "100px" });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={boxRef} className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 to-[#0b1a33] ${className}`}>
      {!webgl && <p role="alert" className="grid h-full place-items-center p-4 text-center text-sm text-white">مرورگر شما از گرافیک سه‌بعدی (WebGL) پشتیبانی نمی‌کند.</p>}
      {webgl && ever && (
        <Canvas dpr={[1, 2]} frameloop={visible ? "always" : "never"} camera={camera} gl={gl} aria-label={label}>
          {children}
        </Canvas>
      )}
      {overlay}
    </div>
  );
}
