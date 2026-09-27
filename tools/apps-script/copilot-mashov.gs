/**
 * משוב על הדרכת Copilot לרכזות משפחתונים — קולט את התשובות מ-tools/copilot-mashov.html
 *
 * התקנה (פעם אחת, 5 דקות):
 *   1. גיליון Google חדש, בשם "משוב Copilot — רכזות".
 *   2. תוספים ← Apps Script. למחוק את מה שיש ולהדביק את כל הקובץ הזה. לשמור.
 *   3. פריסה ← פריסה חדשה ← סוג: אפליקציית אינטרנט.
 *        הפעלה בתור: אני · למי יש גישה: כל אחד.
 *   4. לאשר את ההרשאות, ולהעתיק את הכתובת שמסתיימת ב-/exec.
 *   5. להדביק אותה בקובץ copilot-mashov.html, בשורה  var API = "…";
 *   6. בעורך: לבחור את הפונקציה setup ← הפעלה ← לאשר הרשאות (פעם אחת).
 *
 * כל משוב = שורה בגיליון, ומייל התראה אלייך (לכתובת של החשבון שפרס את הסקריפט).
 */

var SHEET_NAME = 'תשובות';
var HEADERS = [
  'מתי', 'איך הייתה ההדרכה (1-5)', 'רלוונטיות (1-5)', 'הכי שימושי', 'השתמשתי מאז',
  'סגנון ההנחיה', 'סגנון — אחר', 'ממליצה', 'למה', 'רשות לצטט', 'שם לציטוט'
];
var NOTIFY = true;   // false = בלי מייל על כל משוב

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true });            // מלכודת לבוטים

    var row = [
      new Date(),
      num_(d.overall), num_(d.relevance),
      clip_(d.best), clip_(d.used),
      clip_(d.style), clip_(d.styleOther),
      clip_(d.recommend), clip_(d.recommendWhy),
      clip_(d.consent), clip_(d.name)
    ];
    sheet_().appendRow(row);

    if (NOTIFY) {
      try {
        MailApp.sendEmail({
          to: Session.getEffectiveUser().getEmail(),
          subject: 'משוב חדש על הדרכת Copilot' + (d.overall ? ' — ' + d.overall + '/5' : ''),
          body: HEADERS.slice(1).map(function (h, i) { return h + ': ' + (row[i + 1] || '—'); }).join('\n')
        });
      } catch (mailErr) { /* המשוב כבר נשמר — מייל שנכשל לא מפיל את השליחה */ }
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// הרצה אחת מהעורך (בחירת setup ← הפעלה) — מאשרת הרשאות ויוצרת את גיליון התשובות
function setup() {
  sheet_();
  MailApp.getRemainingDailyQuota();
}

// בדיקה מהדפדפן: פתיחת כתובת ה-/exec צריכה להחזיר {"ok":true}
function doGet() {
  return json_({ ok: true, service: 'copilot-mashov' });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#ede9fe');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  }
  return sh;
}

function num_(v) { var n = parseInt(v, 10); return n >= 1 && n <= 5 ? n : ''; }
function clip_(v) {
  var s = String(v == null ? '' : v).slice(0, 3000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;              // שלא ייקרא כנוסחה בגיליון
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
