import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useOnline } from "./useOnline";
import { CircleCheck, RefreshCw, WifiOff, X } from "lucide-react";

/** نوار وضعیت: آفلاین بودن، آماده شدن حالت آفلاین، و نسخه‌ی جدید. */
export function PwaStatus() {
  const online = useOnline();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // پیام «آماده‌ی آفلاین» فقط چند ثانیه نمایش داده می‌شود.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3 pointer-events-none">
      {!online && (
        <div role="status" className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1 text-sm font-medium text-slate-900 shadow">
          <WifiOff className="size-4" aria-hidden="true" /> آفلاین هستید؛ محتوای ذخیره‌شده در دسترس است
        </div>
      )}
      {(offlineReady || needRefresh) && (
        <div role="alert" className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          <span className="inline-flex items-center gap-2">{!needRefresh && <CircleCheck className="size-4 text-brand-500" aria-hidden="true" />}{needRefresh ? "نسخه‌ی جدید آماده است." : "برنامه برای استفاده‌ی آفلاین آماده شد."}</span>
          {needRefresh && (
            <button className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1 font-medium text-white" onClick={() => updateServiceWorker(true)}>
              <RefreshCw className="size-3.5" aria-hidden="true" /> به‌روزرسانی
            </button>
          )}
          <button className="opacity-70 hover:opacity-100" onClick={close} aria-label="بستن"><X className="size-4" aria-hidden="true" /></button>
        </div>
      )}
    </div>
  );
}
