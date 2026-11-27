import { openDB } from "idb";

const db = () =>
  openDB("school-books", 1, {
    upgrade(d) {
      d.createObjectStore("pdf");
    },
  });

/** فایل PDF که کاربر خودش انتخاب کرده؛ برای استفاده‌ی همیشگی و آفلاین ذخیره می‌شود. */
export async function saveLocalPdf(key: string, data: ArrayBuffer) {
  await (await db()).put("pdf", data, key);
}

export async function getLocalPdf(key: string): Promise<ArrayBuffer | undefined> {
  try {
    return await (await db()).get("pdf", key);
  } catch {
    return undefined;
  }
}
