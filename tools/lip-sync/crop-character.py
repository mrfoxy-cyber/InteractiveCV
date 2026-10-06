"""Losslessly extract mapped animation patches; never edit source artwork."""
import argparse
import json
from pathlib import Path
from PIL import Image


def export(source, output):
    before = after = 0
    count = 0
    used = set()

    def crop(folder, original, rectangle, filename):
        nonlocal before, after, count
        path = source / folder / original
        with Image.open(path) as image:
            x, y, width, height = rectangle
            if x < 0 or y < 0 or width < 1 or height < 1 or x + width > image.width or y + height > image.height:
                raise ValueError(f"Invalid crop: {original}")
            patch = image.crop((x, y, x + width, y + height))
            target = output / folder / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            patch.save(target, optimize=True)
            with Image.open(target) as saved:
                if saved.mode != patch.mode or saved.size != patch.size or saved.tobytes() != patch.tobytes():
                    raise ValueError(f"Crop pixels changed: {filename}")
            if path not in used:
                before += path.stat().st_size
                used.add(path)
            after += target.stat().st_size
            count += 1
        return [0, 0, width, height], {"width": width, "height": height}

    regions = json.loads((source / 'base/regions.json').read_text(encoding='utf-8'))
    regions['layers'] = [layer for layer in regions['layers'] if layer['group'] in ('blink', 'hair')]
    for layer in regions['layers']:
        filename = layer['id'] + '.patch.png'
        rect, size = crop('base', layer['source'], layer['bounds'], filename)
        layer['source'] = filename
        layer['sourceRect'] = rect
        layer['sourceSize'] = size
    regions['storage'] = 'Lossless native-pixel patches. Destination bounds, feather and root fade unchanged.'
    (output / 'base/regions.compact.json').write_text(json.dumps(regions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    mouths = json.loads((source / 'mouths/mouth-map.json').read_text(encoding='utf-8'))
    mouths['sources'] = {}
    for pose in mouths['poses']:
        filename = 'mouth-' + pose['id'] + '.patch.png'
        original_rect = pose['sourceRect'][:]
        rect, size = crop('mouths', pose['source'], original_rect, filename)
        pose['originalSourceRect'] = original_rect
        pose['source'] = filename
        pose['sourceRect'] = rect
        mouths['sources'][filename] = size
    mouths['notes'] = ['Lossless crops of the registered full-frame artwork. Destination region and pose IDs are unchanged.', 'Original sources are retained for editing; playback loads only these compact patches.']
    (output / 'mouths/mouth-map.compact.json').write_text(json.dumps(mouths, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    character = json.loads((source / 'character.json').read_text(encoding='utf-8'))
    character['regions'] = 'base/regions.compact.json'
    character['mouths'] = 'mouths/mouth-map.compact.json'
    (output / 'character.json').write_text(json.dumps(character, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{count} lossless patches verified; source animation images {before:,} bytes -> patches {after:,} bytes ({100 * (1-after/before):.2f}% reduction).')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    export(args.source, args.output)
