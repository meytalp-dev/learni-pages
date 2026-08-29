#!/usr/bin/env node
/**
 * סנכרון התור מול מה שבאמת פורסם בעמוד.
 *
 * שולף את כל הפוסטים החיים מפייסבוק ומאינסטגרם, משווה טקסט מלא מול posts-data.json,
 * ומסמן published כל פוסט שכבר באוויר — גם אם פורסם ידנית ולא דרך הסוכן.
 * מדווח גם על כפילויות אמיתיות: אותו טקסט שפורסם יותר מפעם אחת באותה פלטפורמה.
 *
 * ברירת המחדל היא תצוגה מקדימה בלבד. לכתיבה לקובץ: --write
 *
 *   node scripts/sync-published.mjs           # דוח בלבד
 *   node scripts/sync-published.mjs --write   # דוח + עדכון posts-data.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GRAPH = 'https://graph.facebook.com/v21.0';
const dataPath = join(here, '..', 'posts', 'posts-data.json');
const WRITE = process.argv.includes('--write');

// משתני סביבה: מ-GitHub Actions, ואם רצים מקומית — מ-scripts/.env
const envPath = join(here, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !process.env[line.slice(0, i).trim()]) {
      process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
}

const { META_USER_TOKEN, META_PAGE_ID, META_IG_USER_ID } = process.env;
if (!META_USER_TOKEN || !META_PAGE_ID || !META_IG_USER_ID) {
  console.error('חסרים משתני סביבה: META_USER_TOKEN / META_PAGE_ID / META_IG_USER_ID');
  process.exit(1);
}

async function graphGet(path, params) {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message} (code ${json.error.code})`);
  return json;
}

// שליפת edge שלם, עם דפדוף
async function pullAll(path, fields, token, cap = 400) {
  let page = await graphGet(path, { fields, limit: '100', access_token: token });
  const all = [...(page.data || [])];
  while (page.paging?.next && all.length < cap) {
    const res = await fetch(page.paging.next);
    page = await res.json();
    if (page.error) break;
    all.push(...(page.data || []));
  }
  return all;
}

// טקסט מנורמל להשוואה: בלי סימני כיווניות ובלי הבדלי רווחים
const norm = (s) => (s || '').replace(/[‎‏ ]/g, '').replace(/\s+/g, ' ').trim();

// זמן ישראל בפורמט של שדה when: "YYYY-MM-DD HH:MM"
const toIL = (iso) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
};

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const { access_token: PAGE_TOKEN, name: pageName } =
  await graphGet(META_PAGE_ID, { fields: 'access_token,name', access_token: META_USER_TOKEN });

const fb = await pullAll(`${META_PAGE_ID}/published_posts`, 'id,message,created_time,permalink_url', PAGE_TOKEN);
const ig = await pullAll(`${META_IG_USER_ID}/media`, 'id,caption,timestamp,media_type,permalink', PAGE_TOKEN);
const fbUrlById = new Map(fb.map((x) => [x.id, x.permalink_url]));
const igUrlById = new Map(ig.map((x) => [x.id, x.permalink]));
console.log(`עמוד: ${pageName} | פייסבוק: ${fb.length} פוסטים | אינסטגרם: ${ig.length} פוסטים\n`);

// --- כפילויות בפועל: אותו טקסט, אותה פלטפורמה, יותר מפעם אחת ---
const dupes = [];
for (const [platform, items, textOf, timeOf] of [
  ['פייסבוק', fb, (x) => x.message, (x) => x.created_time],
  ['אינסטגרם', ig, (x) => x.caption, (x) => x.timestamp],
]) {
  const byText = new Map();
  for (const item of items) {
    const key = norm(textOf(item));
    if (!key) continue;
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(item);
  }
  for (const [key, group] of byText) {
    if (group.length > 1) dupes.push({ platform, key, group: group.map((x) => ({ id: x.id, at: toIL(timeOf(x)) })) });
  }
}

console.log('=== כפילויות בפועל בעמוד ===');
if (!dupes.length) console.log('אין. כל פוסט מופיע פעם אחת בלבד.\n');
for (const d of dupes) {
  console.log(`${d.platform} · פורסם ${d.group.length} פעמים :: ${d.key.slice(0, 70)}`);
  d.group.sort((a, b) => a.at.localeCompare(b.at)).forEach((x) => console.log(`    ${x.at}  ${x.id}`));
}

// --- התאמת התור למה שבאוויר ---
console.log('\n=== פוסטים בתור שכבר פורסמו ===');
const fixed = [];
let linked = 0;

for (const post of data.posts) {
  const liveFB = fb.filter((x) => norm(x.message) === norm(post.fb));
  // באינסטגרם לפעמים נוסח הפייסבוק הוא שנשלח, ולכן בודקים את שני הנוסחים
  const liveIG = ig.filter((x) => norm(x.caption) === norm(post.ig) || norm(x.caption) === norm(post.fb));

  if (post.status !== 'published' && (liveFB.length || liveIG.length)) {
    const times = [...new Set([
      ...liveFB.map((x) => toIL(x.created_time)),
      ...liveIG.map((x) => toIL(x.timestamp)),
    ])].sort();
    console.log(`✔ ${post.id} [${post.status} → published] פורסם ב-${times[0]} :: ${post.title}`);
    post.status = 'published';
    post.publishedAt = times[0];
    if (liveFB.length && !post.fbPostId) post.fbPostId = liveFB[0].id;
    if (liveIG.length && !post.igMediaId) post.igMediaId = liveIG[0].id;
    post.note = 'זוהה כמפורסם בסנכרון מול העמוד — פורסם מחוץ לתור';
    fixed.push(post.id);
  } else if (post.status === 'published' && Math.max(liveFB.length, liveIG.length) > 1) {
    const times = [...new Set([
      ...liveFB.map((x) => toIL(x.created_time)),
      ...liveIG.map((x) => toIL(x.timestamp)),
    ])].sort();
    console.log(`⚠ ${post.id} — פורסם ${Math.max(liveFB.length, liveIG.length)} פעמים: ${times.join(' , ')} :: ${post.title}`);
  }

  if (post.status !== 'published') continue;

  // קישורים לפוסט החי, לארכיון בדף. קודם לפי המזהה השמור, ואם אין — לפי התאמת טקסט.
  const fbUrl = fbUrlById.get(post.fbPostId) || (liveFB.length ? liveFB[0].permalink_url : null);
  const igUrl = igUrlById.get(post.igMediaId) || (liveIG.length ? liveIG[0].permalink : null);
  if (fbUrl && post.fbUrl !== fbUrl) { post.fbUrl = fbUrl; linked++; }
  if (igUrl && post.igUrl !== igUrl) { post.igUrl = igUrl; linked++; }
}

if (!fixed.length) console.log('התור מסונכרן — אין פוסט שכבר באוויר ועדיין ממתין.');
console.log(`קישורים לארכיון: ${linked} עודכנו.`);

if (WRITE && (fixed.length || linked)) {
  writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nposts-data.json עודכן — ${fixed.length} סומנו published, ${linked} קישורים.`);
} else if (fixed.length || linked) {
  console.log(`\n(תצוגה מקדימה בלבד. להרצה אמיתית: node scripts/sync-published.mjs --write)`);
}
