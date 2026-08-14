# חיבור לרני ל-Meta — פרסום אוטומטי לפייסבוק ואינסטגרם

> **✅ החיבור כבר קיים ופעיל!** הסקריפט קורא אוטומטית את הטוקן מהחיבור של facebook-mcp
> (שהוקם בפרויקט ort-presentation-builder). בדיקה: `node publish-post.mjs --check`
> המדריך הזה נשמר למקרה שהטוקן יפוג ותצטרכו להנפיק חדש.

## מה צריך שיהיה קיים
1. **עמוד פייסבוק** של לרני (עמוד, לא פרופיל)
2. **חשבון אינסטגרם עסקי/יוצר** של לרני, **מקושר לעמוד הפייסבוק**
   (אינסטגרם ← הגדרות ← חשבון ← מעבר לחשבון מקצועי, ואז קישור לעמוד בהגדרות העמוד בפייסבוק)

## שלב 1 — אפליקציית Meta
1. נכנסים ל-https://developers.facebook.com/apps/ (יש לך כבר חשבון מהפרויקט של גולדפיש)
2. אפשר להשתמש באפליקציה הקיימת או ליצור חדשה: **Create App → Business** (שם: "Learni Publisher")

## שלב 2 — טוקן עם הרשאות
1. נכנסים ל-**Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. בוחרים את האפליקציה למעלה מימין
3. **Add Permissions** — מוסיפים:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
4. לוחצים **Generate Access Token** → מאשרים בחלון של פייסבוק → בוחרים את עמוד לרני ואת חשבון האינסטגרם

## שלב 3 — שלושת הערכים
בתוך ה-Graph API Explorer (עם הטוקן מהשלב הקודם):

1. **PAGE_ID**: מריצים בשורת הכתובת של הExplorer: `me/accounts` — מוצאים את עמוד לרני, מעתיקים את `id` ואת `access_token` של העמוד (זה ה-**PAGE_TOKEN**)
2. **IG_USER_ID**: מריצים: `{PAGE_ID}?fields=instagram_business_account` — מעתיקים את ה-id

> טיפ: כדי שהטוקן לא יפוג אחרי שעתיים, מאריכים אותו ב-**Access Token Debugger**
> (https://developers.facebook.com/tools/debug/accesstoken/ → Extend Access Token),
> ואז לוקחים שוב את ה-page token מ-`me/accounts` — page token שנגזר מטוקן מוארך לא פג.

## שלב 4 — קובץ .env
יוצרים קובץ בשם `.env` בתיקייה הזו (`learni-pages/scripts/`) עם:

```
META_PAGE_ID=מספר-עמוד-הפייסבוק
META_IG_USER_ID=מספר-חשבון-האינסטגרם
META_PAGE_TOKEN=הטוקן-הארוך
```

הקובץ הזה **לא עולה לגיטהאב** (מוגן ב-.gitignore) — הטוקן נשאר רק במחשב שלך.

## שימוש
```
node publish-post.mjs --list                                # רשימת הפוסטים
node publish-post.mjs --post p1 --to fb,ig                  # פרסום עכשיו לשניהם
node publish-post.mjs --post p1 --to fb --when "2026-08-17T20:00"   # תזמון בפייסבוק
```

- **פייסבוק**: תומך גם בתזמון עתידי דרך הסקריפט
- **אינסטגרם**: ה-API מפרסם מיידית בלבד; תזמון לאינסטגרם עושים ב-Meta Business Suite,
  או פשוט מבקשים מקלוד לפרסם ברגע הנכון

## איך זה עובד
התמונות כבר יושבות בכתובת ציבורית (GitHub Pages), והטקסטים ב-`posts/posts-data.json` —
הסקריפט רק שולח ל-Graph API את הקישור לתמונה + הטקסט המתאים לכל פלטפורמה.
