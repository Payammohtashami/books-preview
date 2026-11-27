/**
 * ساخت پوست یک‌تکه در پس‌زمینه تا رابط کاربری هنگام بازشدن مدل قفل نشود.
 * پیام ورودی: هیچ؛ خروجی: { pos, index } با انتقال بافرها.
 */
import { buildSkinArrays } from './body-skin-sdf';

const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown, t: Transferable[]) => void };

ctx.onmessage = () => {
  const r = buildSkinArrays();
  ctx.postMessage(r, [r.pos.buffer, r.index.buffer]);
};
