"""Generate missing narration data locally, without replacing existing exports."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
import importlib.util
import io
import json
from pathlib import Path
import sys
import unicodedata
from urllib.parse import quote
import wave


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, filename)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--decoder-path', type=Path)
    args = parser.parse_args()
    if args.decoder_path:
        sys.path.insert(0, str(args.decoder_path))
    import miniaudio
    pipeline = module('local_pipeline', args.project / 'tools/lip-sync/server.py')
    executable = args.project / 'tools/lip-sync/vendor/Rhubarb-Lip-Sync-1.14.0-Windows/rhubarb.exe'
    script = args.project / 'dist/assets/cv/interactive/audiotour/script.odt'
    if script.is_file():
        clips = module('script_export', args.project / 'tools/lip-sync/sync-narration-script.py').extract_script(script)['clips']
    else:
        clips = json.loads((args.project / 'dist/character-map/narration-scripts.json').read_text(encoding='utf-8'))['clips']
    def stem(name):
        return ''.join(c for c in unicodedata.normalize('NFD', Path(name).stem.lower()) if not unicodedata.combining(c))
    aliases = {'goatly': 'project-goatly', 'mental-model-graph': 'project-mmg', 'frog-game': 'project-frog', 'komvux': 'education-komvux', 'gymnasium': 'education-gymnasium'}
    scripts = {stem(clip['file']): clip for clip in clips}
    audio_root = args.project / 'dist/voice-tour/audio/narration'
    saved_root = args.project / 'dist/audio-tour-test/narrations'
    args.output.mkdir(parents=True, exist_ok=True)
    catalogue = []
    pending = []
    for audio in sorted(audio_root.glob('*.mp3')):
        filename = audio.stem + '.narration.json'
        key = stem(audio.name)
        clip = scripts.get(key) or scripts.get(aliases.get(key))
        if not clip:
            raise ValueError('No matching script for ' + audio.name)
        saved = saved_root / filename
        title = json.loads(saved.read_text(encoding='utf-8'))['title'] if saved.is_file() else clip['title']
        catalogue.append({'file': filename, 'title': title})
        if saved.is_file() or (args.output / filename).is_file():
            print('Preserved: ' + filename, flush=True)
        else:
            pending.append((audio, filename, clip))

    def generate(item):
        audio, filename, clip = item
        # Decode bytes so Unicode Windows filenames (such as Skövde) never pass
        # through a native decoder's narrow-character filename interface.
        decoded = miniaudio.decode(audio.read_bytes(), output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1, sample_rate=16000)
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(decoded.samples.tobytes())
        timing = pipeline.analyze({'filename': audio.name, 'recognizer': 'pocketSphinx', 'script': clip['text'], 'audioBase64': base64.b64encode(buffer.getvalue()).decode('ascii')}, executable)
        timing['mouthOffsetMs'] = -30
        config = {'schemaVersion': 1, 'kind': 'audio-tour-narration', 'title': clip['title'],
                  'character': '../anchored-character/character.json',
                  'audio': {'src': '../../voice-tour/audio/narration/' + quote(audio.name)},
                  'transcript': clip['text'], 'mouthTiming': timing,
                  'animations': {'blink': {'enabled': True, 'cycleMs': 4800, 'closeMs': 70, 'holdMs': 60, 'openMs': 100}, 'hair': {'enabled': True, 'cycleMs': 7200}}}
        target = args.output / filename
        with target.open('x', encoding='utf-8') as output:
            json.dump(config, output, ensure_ascii=False, indent=2)
            output.write('\n')
        return filename, len(timing['mouthCues']), timing['durationMs']

    failures = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(generate, item): item[1] for item in pending}
        for future in as_completed(futures):
            try:
                filename, cues, duration = future.result()
                print(f'Generated: {filename} ({cues} cues, {duration} ms)', flush=True)
            except Exception as error:
                failures.append(futures[future])
                print(f'FAILED: {futures[future]}: {error}', flush=True)
    if failures:
        raise RuntimeError('Generation failed for: ' + ', '.join(failures))
    catalogue.sort(key=lambda item: (item['file'] != 'welcome.narration.json', item['title']))
    (args.output / 'catalogue.json').write_text(json.dumps({'schemaVersion': 1, 'narrations': catalogue}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Finished: {len(pending)} generated, {len(catalogue)-len(pending)} preserved, {len(catalogue)} total.', flush=True)


if __name__ == '__main__':
    main()
