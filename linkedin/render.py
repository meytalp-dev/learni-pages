# -*- coding: utf-8 -*-
"""מרנדר את כרטיסי הלינקדין ל-PNG (1080×1350) עם Chrome headless.
   python render.py            → כל הכרטיסים
   python render.py li-03      → רק כרטיס אחד (קידומת שם)
"""
import glob, os, subprocess, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
IMG = os.path.join(HERE, 'img')
os.makedirs(IMG, exist_ok=True)

only = sys.argv[1] if len(sys.argv) > 1 else None
files = sorted(glob.glob(os.path.join(HERE, 'li-*.html')))
if only:
    files = [f for f in files if os.path.basename(f).startswith(only)]

for f in files:
    out = os.path.join(IMG, os.path.basename(f).replace('.html', '.png'))
    url = 'file:///' + f.replace('\\', '/')
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
           '--force-device-scale-factor=1',
           '--window-size=1080,1350', '--virtual-time-budget=8000',
           f'--screenshot={out}', url]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    ok = os.path.exists(out) and os.path.getsize(out) > 20000
    print(('OK  ' if ok else 'FAIL'), os.path.basename(out))
