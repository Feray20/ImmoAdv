"""Layoutprüfung: überlappende Wörter, Text außerhalb der Seite, leere Seiten. Kompakte Ausgabe."""
import re, subprocess, sys, html
from pathlib import Path

WM = re.compile(r'^(MUSTER|FIKTIVER|FALL|IMMOADV\.DE|VORSCHAU|NICHT|FÜR|DIE|BANK|REGISTRIERUNGSNACHWEIS|VORLAGE|ENTWURF|GÜLTIG|·|—|–)$')

def words(pdf):
    out = subprocess.run(['pdftotext', '-bbox', pdf, '-'], capture_output=True, text=True).stdout
    pages = []
    for pm in re.finditer(r'<page width="([\d.]+)" height="([\d.]+)">(.*?)</page>', out, re.S):
        w, h, body = float(pm.group(1)), float(pm.group(2)), pm.group(3)
        ws = []
        for m in re.finditer(r'<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">(.*?)</word>', body):
            x0, y0, x1, y1 = map(float, m.groups()[:4]); t = html.unescape(m.group(5))
            ws.append((x0, y0, x1, y1, t))
        pages.append((w, h, ws))
    return pages

def check(pdf):
    issues = []
    for pi, (w, h, ws) in enumerate(words(pdf), 1):
        body = [x for x in ws if not WM.match(x[4]) and (x[3] - x[1]) < 30 and not re.fullmatch(r'[A-ZÄÖÜ.—·]{1,3}', x[4])]
        if len(body) < 3: issues.append(f'S{pi}: fast leer ({len(body)} Wörter)')
        for x0, y0, x1, y1, t in body:
            if x0 < 8 or x1 > w - 8 or y0 < 2 or y1 > h - 4: issues.append(f'S{pi}: Rand "{t}" ({x0:.0f},{y0:.0f},{x1:.0f},{y1:.0f})')
        n = 0
        for i in range(len(body)):
            a = body[i]
            for j in range(i + 1, len(body)):
                b = body[j]
                ix = min(a[2], b[2]) - max(a[0], b[0]); iy = min(a[3], b[3]) - max(a[1], b[1])
                if ix > 1.0 and iy > 1.5:
                    ha, hb = a[3] - a[1], b[3] - b[1]
                    if iy > 0.35 * min(ha, hb):
                        n += 1
                        if n <= 4: issues.append(f'S{pi}: Überlappung "{a[4]}" <-> "{b[4]}" @({a[0]:.0f},{a[1]:.0f})')
        if n > 4: issues.append(f'S{pi}: … insgesamt {n} Überlappungen')
    return issues

for f in sorted(Path(sys.argv[1]).glob('*.pdf')):
    iss = check(str(f))
    print(f'## {f.stem}: {"OK" if not iss else str(len(iss)) + " Befunde"}')
    for i in iss[:12]: print('   ', i)
