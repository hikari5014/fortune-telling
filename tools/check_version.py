#!/usr/bin/env python3
"""檢查 src/data/changelog.js 與 sw.js 的版號是否一致。"""
import re, sys, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
log = (root / 'src/data/changelog.js').read_text(encoding='utf-8')
sw = (root / 'sw.js').read_text(encoding='utf-8')

app = re.search(r"APP_VERSION\s*=\s*'([^']+)'", log).group(1)
first = re.search(r"\{\s*\n?\s*v:\s*'([^']+)'", log).group(1)
cache = re.search(r"VERSION\s*=\s*'xj-([^']+)'", sw).group(1)

errs = []
if app != first:
    errs.append(f"APP_VERSION ({app}) 與 CHANGELOG 第一筆 ({first}) 不一致")
if app != cache:
    errs.append(f"APP_VERSION ({app}) 與 sw.js 快取版本 xj-{cache} 不一致")

if errs:
    print('\n'.join('✗ ' + e for e in errs)); sys.exit(1)
print(f'✓ 版號一致：{app}')
