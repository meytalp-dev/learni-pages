#!/usr/bin/env node
// תיקון חד-פעמי: השלמת פרסומי אינסטגרם שנכשלו ב-9007 (הפוסט כבר פורסם לפייסבוק).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const GRAPH = 'https://graph.facebook.com/v21.0';
const dataPath = join(here, '..', 'posts', 'posts-data.json');

const envPath = join(here, '.env');
if (!process.env.META_USER_TOKEN && existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { META_USER_TOKEN, META_PAGE_ID, META_IG_USER_ID } = process.env;

async function graphGet(path, params) {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message} (code ${json.error.code})`);
  return json;
}
async function graphPost(path, params, token) {
  const res = await fetch(`${GRAPH}/${path}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: token }) });
  const json = await res.json();
  if (json.error) throw new Error(`${path}: ${json.error.message} (code ${json.error.code})`);
  return json;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const targets = data.posts.filter(p => p.status === 'published' && !p.igMediaId && p.note && p.note.includes('אינסטגרם נכשל'));
console.log('פוסטים להשלמת אינסטגרם:', targets.map(p => p.id).join(', ') || 'אין');

const PAGE_TOKEN = (await graphGet(META_PAGE_ID, { fields: 'access_token', access_token: META_USER_TOKEN })).access_token;
let ok = 0, bad = 0;

for (const post of targets) {
  const mediaUrl = data.imageBase + post.image;
  console.log(`\n▶ ${post.id} — ${post.title}`);
  try {
    const container = await graphPost(`${META_IG_USER_ID}/media`, { image_url: mediaUrl, caption: post.ig }, PAGE_TOKEN);
    let done = false;
    for (let i = 0; i < 12; i++) {
      const st = await graphGet(container.id, { fields: 'status_code', access_token: PAGE_TOKEN });
      if (st.status_code === 'FINISHED') { done = true; break; }
      if (st.status_code === 'ERROR') throw new Error('עיבוד התמונה נכשל');
      await sleep(5000);
    }
    if (!done) throw new Error('העיבוד לא הסתיים בזמן');
    const r = await graphPost(`${META_IG_USER_ID}/media_publish`, { creation_id: container.id }, PAGE_TOKEN);
    post.igMediaId = r.id;
    delete post.note;
    ok++;
    console.log(`  ✓ אינסטגרם: ${r.id}`);
  } catch (e) {
    bad++;
    console.error('  ✗', e.message);
  }
}

writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`\nהושלמו: ${ok}, נכשלו: ${bad}`);
if (bad) process.exit(1);
