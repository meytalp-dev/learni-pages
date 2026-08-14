// בדיקת תוקף החיבור ל-Meta — קורא את הטוקן מה-.mcp.json הקיים, לא מדפיס אותו
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('C:/Users/meyta/Downloads/ort-presentation-builder/.mcp.json', 'utf8'));
const env = cfg.mcpServers.facebook.env;
const token = env.FB_USER_TOKEN;
const pageId = env.FB_LEARNY_PAGE_ID;

const get = async (path) => {
  const res = await fetch(`https://graph.facebook.com/v25.0/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`);
  return res.json();
};

const me = await get('me?fields=id,name');
if (me.error) {
  console.log('טוקן לא תקף:', me.error.message);
  process.exit(1);
}
console.log('טוקן תקף. משתמש:', me.name);

const page = await get(`${pageId}?fields=name,instagram_business_account`);
if (page.error) {
  console.log('שגיאת עמוד:', page.error.message);
} else {
  console.log('עמוד:', page.name);
  console.log('אינסטגרם מקושר:', page.instagram_business_account ? page.instagram_business_account.id : 'לא');
}

const accounts = await get('me/accounts?fields=id,name');
if (!accounts.error) {
  console.log('עמודים זמינים:', accounts.data.map(p => `${p.name} (${p.id})`).join(' | '));
}
