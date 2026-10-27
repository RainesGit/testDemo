#!/usr/bin/env python3
"""import-pics.py — turns raw AI pictures into the shop's picture set (docs/art-ai-brief.md).

Put the raw files in game/art/raw/ named by picture id (tea-black.png, oke-c250-happy.jpg, street.png, ...; the ids
are in art/shop/ids.json, written by `node tools/art/pic-ids.mjs`). Run from game/:

    pip install pillow
    python3 tools/art/import-pics.py [--raw art/raw] [--out art/shop] [--tol 34] [--quality 88]

For each raw file:
  fit 'object' (equipment, props, people): the flat background is cut away (flood fill from the border, tolerance
    --tol; a PNG that already has transparency is kept as it is), trimmed to the content, fitted into the drawing's
    frame (ids.json viewBox) touching the bottom, centred, then scaled to the suggested pixel size.
  fit 'scene' (street, table): kept opaque, cropped from the centre to the frame's shape (cover), scaled.
Writes <id>.webp into --out and rewrites --out/manifest.json with every known id that has a file there, so the game
picks the pictures up on the next load (?pics=0 shows the drawn art for comparison). Unknown file names are listed and
skipped. Prints a short report: imported, skipped, and how many ids still have no picture.
"""
import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter
except ImportError:  # pragma: no cover
    sys.exit('needs Pillow: pip install pillow')

EXTS = ('.png', '.webp', '.jpg', '.jpeg')
MARK = (1, 254, 3)


def cut_out(im, tol):
    """RGBA with the border-connected flat background made transparent (soft 1 px edge)."""
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        rgba = im.convert('RGBA')
        lo, hi = rgba.getchannel('A').getextrema()
        if lo < 250:  # already cut out
            return rgba
    rgb = im.convert('RGB')
    w, h = rgb.size
    fill = rgb.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for xy in seeds:
        if fill.getpixel(xy) != MARK:
            ImageDraw.floodfill(fill, xy, MARK, thresh=tol)
    # alpha: 0 where the flood reached; erode one pixel and soften so no light fringe is left
    alpha = ImageChops.difference(fill, Image.new('RGB', (w, h), MARK)).convert('L').point(lambda v: 255 if v else 0)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def fit_object(im, vb, px):
    """Trim, fit into the frame's aspect touching the bottom (centred), scale to px."""
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    if box:
        im = im.crop(box)
    fw, fh = px
    k = min(fw / im.width, fh / im.height)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    canvas.paste(im, ((fw - im.width) // 2, fh - im.height), im)
    return canvas


def fit_scene(im, px):
    """Opaque, centre-cropped to the frame's shape, scaled to px."""
    im = im.convert('RGB')
    fw, fh = px
    k = max(fw / im.width, fh / im.height)
    im = im.resize((max(fw, round(im.width * k)), max(fh, round(im.height * k))), Image.LANCZOS)
    x, y = (im.width - fw) // 2, (im.height - fh) // 2
    return im.crop((x, y, x + fw, y + fh))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--raw', default='art/raw')
    ap.add_argument('--out', default='art/shop')
    ap.add_argument('--ids', default='art/shop/ids.json')
    ap.add_argument('--tol', type=int, default=34, help='background colour tolerance (0-255)')
    ap.add_argument('--quality', type=int, default=88)
    a = ap.parse_args()

    ids = {x['id']: x for x in json.loads(Path(a.ids).read_text(encoding='utf-8'))}
    raw, out = Path(a.raw), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    done, unknown = [], []
    for f in sorted(raw.iterdir()) if raw.is_dir() else []:
        if f.suffix.lower() not in EXTS:
            continue
        spec = ids.get(f.stem)
        if not spec:
            unknown.append(f.name)
            continue
        im = Image.open(f)
        if spec['fit'] == 'scene':
            pic = fit_scene(im, spec['px'])
        else:
            pic = fit_object(cut_out(im, a.tol), spec['viewBox'], spec['px'])
        pic.save(out / f'{f.stem}.webp', 'WEBP', quality=a.quality, method=6)
        done.append(f.stem)

    have = sorted(i for i in ids if (out / f'{i}.webp').exists())
    manifest = {'version': 1, 'pics': {i: f'{i}.webp' for i in have}}
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'imported {len(done)}: {" ".join(done) or "-"}')
    if unknown:
        print(f'skipped (not a picture id): {" ".join(unknown)}')
    print(f'manifest: {len(have)} pictures, {len(ids) - len(have)} ids still drawn')


if __name__ == '__main__':
    main()
