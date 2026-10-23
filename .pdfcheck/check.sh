#!/bin/bash
# Rendert alle PDFs, extrahiert Text, prüft auffällige Zeichen.
cd /vercel/immoadv
OUT=/vercel/out; rm -rf $OUT; mkdir -p $OUT
npx tsx --tsconfig .pdfcheck/tsconfig.json .pdfcheck/render-all.tsx $OUT 2>&1 | grep -E '^(ok|FAIL|done)|Error' | cut -c1-400
for f in $OUT/*.pdf; do n=$(basename $f .pdf); pdftotext $f $OUT/$n.raw; done
