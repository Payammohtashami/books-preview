/**
 * جزئیات ماهیچه‌ها: سرها و بخش‌های هر ماهیچه (مثلاً سه سر دلتایی، چهار سر ران).
 * هر مورد به یکی از اجزای اصلی ماهیچه‌ای در body-data.ts وصل است و در مدل سه‌بعدی زیرمش جدا دارد.
 * منطق خالص است (بدون React و three).
 */
import type { Landmark } from './skeleton-landmarks';

function l(id: string, name: string, en: string, parent: string, text: string): Landmark {
  return { id, name, en, parent, text };
}

export const MUSCLE_LANDMARKS: Landmark[] = [
  l('scm-sternal-head', 'سر جناغی', 'Sternal head', 'sternocleidomastoid', 'از بالای جناغ سینه شروع می‌شود و تا استخوان پشت گوش (زائدهٔ پستانی) می‌رود. با انقباض یک‌طرفه سر را می‌چرخاند.'),
  l('scm-clavicular-head', 'سر ترقوه‌ای', 'Clavicular head', 'sternocleidomastoid', 'از انتهای داخلی ترقوه شروع می‌شود و با سر جناغی یکی می‌شود. با انقباض هر دو طرف سر را به جلو خم می‌کند.'),
  l('trapezius-upper', 'بخش بالایی ذوزنقه‌ای', 'Upper trapezius', 'trapezius', 'از پشت جمجمه و گردن به ترقوه و شانه می‌رود و کتف را بالا می‌کشد (شانه‌بالا‌انداختن).'),
  l('trapezius-middle', 'بخش میانی ذوزنقه‌ای', 'Middle trapezius', 'trapezius', 'از مهره‌های گردنی پایینی و پشتی بالایی به کتف می‌رسد و کتف‌ها را به ستون مهره نزدیک می‌کند.'),
  l('trapezius-lower', 'بخش پایینی ذوزنقه‌ای', 'Lower trapezius', 'trapezius', 'از مهره‌های پشتی پایین‌تر به خار کتف می‌رود و کتف را پایین می‌کشد.'),
  l('infraspinatus', 'ماهیچهٔ زیرخاری', 'Infraspinatus', 'rotator-cuff', 'روی کتف و زیر خار آن؛ بازو را به بیرون می‌چرخاند و مفصل شانه را پایدار نگه می‌دارد. یکی از چهار ماهیچهٔ روتیتور کاف.'),
  l('teres-major', 'گرد بزرگ', 'Teres major', 'rotator-cuff', 'از گوشهٔ پایینی کتف به استخوان بازو می‌رود؛ بازو را به عقب می‌کشد و به داخل می‌چرخاند.'),
  l('deltoid-anterior', 'دلتایی قدامی', 'Anterior deltoid', 'deltoid', 'بخش جلوی شانه که بازو را به جلو بالا می‌آورد.'),
  l('deltoid-middle', 'دلتایی میانی', 'Middle deltoid', 'deltoid', 'بخش کنار شانه که بازو را به پهلو (دور از بدن) بالا می‌برد.'),
  l('deltoid-posterior', 'دلتایی خلفی', 'Posterior deltoid', 'deltoid', 'بخش پشت شانه که بازو را به عقب می‌کشد.'),
  l('pec-clavicular-head', 'سر ترقوه‌ای سینه‌ای', 'Clavicular head', 'pectoralis-major', 'بخش بالایی سینه که از ترقوه شروع می‌شود و بازو را به جلو و بالا می‌آورد.'),
  l('pec-sternocostal-head', 'سر جناغی‌دنده‌ای', 'Sternocostal head', 'pectoralis-major', 'بخش بزرگ‌تر و پایین‌تر که از جناغ و غضروف دنده‌ها شروع می‌شود و بازو را به سمت داخل می‌کشد.'),
  l('biceps-long-head', 'سر بلند دوسر', 'Long head of biceps', 'biceps', 'زردپی آن از درون مفصل شانه می‌گذرد و به لبهٔ بالای حفرهٔ کتف می‌چسبد.'),
  l('biceps-short-head', 'سر کوتاه دوسر', 'Short head of biceps', 'biceps', 'از زائدهٔ کوراکوئید کتف شروع می‌شود و با سر بلند به زردپی مشترک می‌رسد.'),
  l('triceps-long-head', 'سر بلند سه‌سر', 'Long head of triceps', 'triceps', 'از زیر حفرهٔ کتف شروع می‌شود و تنها سری است که روی مفصل شانه هم اثر دارد.'),
  l('triceps-lateral-head', 'سر خارجی سه‌سر', 'Lateral head of triceps', 'triceps', 'از پشت استخوان بازو در سمت خارج شروع می‌شود؛ ظاهر نعل‌اسبی بازو از آن است.'),
  l('flexor-carpi-radialis', 'خم‌کنندهٔ رادیال مچ', 'Flexor carpi radialis', 'forearm-flexors', 'مچ را خم می‌کند و به سمت شست می‌کشد. زردپی‌اش در مچ لمس می‌شود.'),
  l('flexor-carpi-ulnaris', 'خم‌کنندهٔ اولنار مچ', 'Flexor carpi ulnaris', 'forearm-flexors', 'در سمت انگشت کوچک ساعد؛ مچ را خم می‌کند و به سمت کوچک‌انگشت می‌کشد.'),
  l('flexor-digitorum-superficialis', 'خم‌کنندهٔ سطحی انگشتان', 'Flexor digitorum superficialis', 'forearm-flexors', 'بند میانی چهار انگشت را خم می‌کند و در گرفتن و چنگ‌زدن نقش دارد.'),
  l('extensor-carpi-radialis', 'بازکنندهٔ رادیال مچ', 'Extensor carpi radialis', 'forearm-extensors', 'مچ را به عقب می‌برد و به سمت شست می‌کشد.'),
  l('extensor-digitorum', 'بازکنندهٔ انگشتان', 'Extensor digitorum', 'forearm-extensors', 'چهار انگشت را باز می‌کند؛ زردپی‌هایش روی پشت دست دیده می‌شود.'),
  l('extensor-carpi-ulnaris', 'بازکنندهٔ اولنار مچ', 'Extensor carpi ulnaris', 'forearm-extensors', 'مچ را به عقب می‌برد و به سمت کوچک‌انگشت می‌کشد.'),
  l('rectus-femoris', 'راست ران', 'Rectus femoris', 'quadriceps', 'تنها سر چهارسر که از لگن شروع می‌شود؛ هم زانو را صاف می‌کند و هم ران را بالا می‌آورد.'),
  l('vastus-lateralis', 'پهن خارجی', 'Vastus lateralis', 'quadriceps', 'بزرگ‌ترین سر چهارسر، در کنار خارجی ران.'),
  l('vastus-medialis', 'پهن داخلی', 'Vastus medialis', 'quadriceps', 'در سمت داخلی ران، بالای زانو؛ کشکک را در مسیرش نگه می‌دارد.'),
  l('adductor-longus', 'نزدیک‌کنندهٔ بلند', 'Adductor longus', 'adductors', 'از استخوان شرمگاهی به پشت استخوان ران می‌رود و ران را به داخل می‌کشد.'),
  l('gracilis', 'نازک‌نی‌ران (گراسیلیس)', 'Gracilis', 'adductors', 'باریک‌ترین نزدیک‌کننده؛ از لگن تا داخل ساق پایین می‌رود و زانو را هم خم می‌کند.'),
  l('adductor-magnus', 'نزدیک‌کنندهٔ بزرگ', 'Adductor magnus', 'adductors', 'بزرگ‌ترین و ضخیم‌ترین نزدیک‌کنندهٔ ران، در عمق داخل و پشت ران.'),
  l('biceps-femoris', 'دوسر رانی', 'Biceps femoris', 'hamstrings', 'همسترینگ سمت خارج ران؛ ران را به عقب می‌برد و زانو را خم می‌کند.'),
  l('semitendinosus', 'نیم‌وتری', 'Semitendinosus', 'hamstrings', 'همسترینگ سمت داخل با زردپی بلند و باریک.'),
  l('semimembranosus', 'نیم‌غشایی', 'Semimembranosus', 'hamstrings', 'همسترینگ عمیق‌تر سمت داخل، با زردپی پهن در بالای ماهیچه.'),
  l('gastrocnemius-medial-head', 'سر داخلی دوقلو', 'Medial head', 'gastrocnemius', 'سر بزرگ‌تر و پایین‌تر دوقلو که از پشت کندیل داخلی ران شروع می‌شود.'),
  l('gastrocnemius-lateral-head', 'سر خارجی دوقلو', 'Lateral head', 'gastrocnemius', 'سر خارجی دوقلو که از کندیل خارجی ران شروع می‌شود؛ هر دو سر به زردپی آشیل می‌رسند.'),
];
