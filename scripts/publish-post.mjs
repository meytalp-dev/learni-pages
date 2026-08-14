#!/usr/bin/env node
/**
 * פרסום פוסט של לרני לפייסבוק ולאינסטגרם דרך Meta Graph API.
 *
 * שימוש:
 *   node publish-post.mjs --post p1 --to fb,ig           פרסום מיידי
 *   node publish-post.mjs --post p1 --to fb --when "2026-08-17T20:00"   תזמון (פייסבוק בלבד)
 *   node publish-post.mjs --list                          רשימת הפוסטים
 *
 * דורש קובץ .env בתיקייה הזו (ראו META-SETUP.md):
 *   META_PAGE_ID=...
 *   META_IG_USER_ID=...
 *   META_PAGE_TOKEN=...
 *
 * הערה: תזמון עתידי דרך ה-API נתמך רק בפייסבוק. באינסטגרם הפרסום מיידי —
 * לתזמון באינסטגרם משתמשים ב-Meta Business Suite.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GRAPH = 'https://graph.facebook.com/v21.0';

// --- args ---
const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : null;
};

const data = JSON.parse(readFileSync(join(here, '..', 'posts', 'posts-data.json'), 'utf8'));

if (args.includes('--list')) {
  for (const p of data.posts) console.log(`${p.id}  ${p.when}  ${p.title}`);
  process.exit(0);
}

// --- .env ---
const envPath = join(here, '.env');
if (!existsSync(envPath)) {
  console.error('חסר קובץ .env — ראו META-SETUP.md בתיקייה הזו.');
  process.exit(1);
}
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
  if (m) env[m[1]] = m[2];
}
const { META_PAGE_ID, META_IG_USER_ID, META_PAGE_TOKEN } = env;

const postId = getArg('post');
const to = (getArg('to') || 'fb,ig').split(',').map(s => s.trim());
const when = getArg('when');

const post = data.posts.find(p => p.id === postId);
if (!post) {
  console.error(`פוסט "${postId}" לא נמצא. אפשרויות: ${data.posts.map(p => p.id).join(', ')}`);
  process.exit(1);
}
const imageUrl = data.imageBase + post.image;

async function graph(path, params) {
  const body = new URLSearchParams({ ...params, access_token: META_PAGE_TOKEN });
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message} (code ${json.error.code})`);
  return json;
}

async function publishFacebook() {
  if (!META_PAGE_ID) throw new Error('חסר META_PAGE_ID ב-.env');
  const params = { url: imageUrl, message: post.fb };
  if (when) {
    const ts = Math.floor(new Date(when).getTime() / 1000);
    if (Number.isNaN(ts)) throw new Error(`תאריך לא תקין: ${when}`);
    params.published = 'false';
    params.scheduled_publish_time = String(ts);
  }
  const r = await graph(`${META_PAGE_ID}/photos`, params);
  console.log(when
    ? `✓ פייסבוק: תוזמן ל-${when} (post id: ${r.id || r.post_id})`
    : `✓ פייסבוק: פורסם (post id: ${r.post_id || r.id})`);
}

async function publishInstagram() {
  if (!META_IG_USER_ID) throw new Error('חסר META_IG_USER_ID ב-.env');
  if (when) console.warn('⚠ אינסטגרם: ה-API לא תומך בתזמון — מפרסם עכשיו. לתזמון השתמשי ב-Business Suite.');
  const container = await graph(`${META_IG_USER_ID}/media`, { image_url: imageUrl, caption: post.ig });
  const r = await graph(`${META_IG_USER_ID}/media_publish`, { creation_id: container.id });
  console.log(`✓ אינסטגרם: פורסם (media id: ${r.id})`);
}

console.log(`פוסט: ${post.title}`);
console.log(`תמונה: ${imageUrl}`);
try {
  if (to.includes('fb')) await publishFacebook();
  if (to.includes('ig')) await publishInstagram();
} catch (e) {
  console.error('✗ שגיאה:', e.message);
  process.exit(1);
}
