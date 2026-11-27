const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const arDigits = "٠١٢٣٤٥٦٧٨٩";

/** عدد را با ارقام فارسی نمایش می‌دهد. */
export const toFa = (n: number | string): string =>
  typeof n === "number"
    ? n.toLocaleString("fa-IR")
    : n.replace(/\d/g, (d) => faDigits[Number(d)]);

/** ارقام فارسی/عربی را به لاتین برمی‌گرداند (برای ورودی کاربر). */
export const toEn = (s: string): string =>
  s
    .replace(/[۰-۹]/g, (d) => String(faDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arDigits.indexOf(d)));

/** حجم فایل به‌صورت خوانا. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${toFa(bytes)} بایت`;
  if (bytes < 1024 ** 2) return `${toFa(Math.round(bytes / 1024))} کیلوبایت`;
  return `${toFa(Math.round((bytes / 1024 ** 2) * 10) / 10)} مگابایت`;
};
