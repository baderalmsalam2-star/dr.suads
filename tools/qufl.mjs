/*  قفلٌ واحد لأدوات الفحص.

    ثلاثٌ منها تُبدّل ملفاتٍ مشتركةً في أثناء عملها ثم تُرجعها:
    tanasuq يُفرغ assets/config.js ليقيس المنصة بلا خادم، وrehearse
    وdukhool يوجّهان data/tenants.js إلى المحاكي. وكلٌّ منها يُرجع
    ما بدّل عند خروجه — لكنه يُبقيه مبدَّلًا دقائقَ وهو يعمل.

    فمن شغّل اثنتين معًا قرأت الثانيةُ ملفًّا بدّلته الأولى. وهذا ما
    وقع: كان فحصُ التباين يعمل في الخلفية — وهو يُفرغ config.js —
    فرأت البروفةُ منصّةً بلا خادم، فسقطت خطوتان. وظننتُ العطب في
    تعديلٍ كتبتُه للتوّ، فمضيتُ أبحث عنه في غير موضعه.

    والقفل يقطع ذلك: من وجد القفل مأخوذًا وقف وقال من أخذه. */
import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';

const LOCK = path.join(path.dirname(fileURLToPath(import.meta.url)), '.qufl');

export function take(name) {
  try {
    //  wx: يفشل إن وُجد الملف — فلا سباق بين فحصٍ وإنشاء.
    fs.writeFileSync(LOCK, JSON.stringify({ name, pid: process.pid, at: Date.now() }), { flag: 'wx' });
  } catch (e) {
    let who = '';
    try { who = JSON.parse(fs.readFileSync(LOCK, 'utf8')).name; } catch (_) { /* قفلٌ تالف */ }
    //  قفلٌ لصاحبٍ ماتَ لا يُبقي الأداةَ موقوفةً إلى الأبد.
    let alive = false;
    try { alive = !!process.kill(JSON.parse(fs.readFileSync(LOCK, 'utf8')).pid, 0); } catch (_) { alive = false; }
    if (alive) {
      console.error('✗ أداةُ فحصٍ أخرى تعمل الآن' + (who ? ` (${who})` : '') +
                    '. تُبدّل ملفاتٍ مشتركة، فانتظر انتهاءها.');
      process.exit(1);
    }
    fs.writeFileSync(LOCK, JSON.stringify({ name, pid: process.pid, at: Date.now() }));
  }
  const free = () => { try { fs.unlinkSync(LOCK); } catch (_) { /* رُفع سلفًا */ } };
  process.on('exit', free);
  process.on('SIGINT', () => { free(); process.exit(130); });
  return free;
}
