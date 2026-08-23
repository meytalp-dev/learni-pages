#!/usr/bin/env node
// בדיקת עשן: הטוקן תקין? העמוד נגיש? קבצי הווידאו זמינים ב-GitHub Pages?
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(join(here, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) process.env[m[1]] = m[2];
}
const { META_USER_TOKEN, META_PAGE_ID, META_IG_USER_ID } = process.env;

const page = await (await fetch(`https://graph.facebook.com/v21.0/${META_PAGE_ID}?fields=name,access_token&access_token=${META_USER_TOKEN}`)).json();
if (page.error) { console.error('PAGE ERROR:', page.error.message); process.exit(1); }
console.log('PAGE OK:', page.name, '| page token:', page.access_token ? 'yes' : 'no');

const ig = await (await fetch(`https://graph.facebook.com/v21.0/${META_IG_USER_ID}?fields=username&access_token=${page.access_token}`)).json();
console.log(ig.error ? 'IG ERROR: ' + ig.error.message : 'IG OK: @' + ig.username);

const data = JSON.parse(readFileSync(join(here, '..', 'posts', 'posts-data.json'), 'utf8'));
const due = data.posts.filter(p => p.status === 'approved');
for (const p of due) {
  const url = p.video ? data.videoBase + p.video : data.imageBase + p.image;
  const res = await fetch(url, { method: 'HEAD' });
  console.log(res.ok ? 'OK ' : 'MISSING ', p.id, url.split('/').pop());
}
