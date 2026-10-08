"""Decode MP3 commands into temporary 16 kHz mono WAVs; never alter sources."""
import argparse
import json
from pathlib import Path
import numpy as np
import soundfile as sf

def resample(samples, rate, target=16000):
    if rate == target:
        return samples
    # Fourier resampling removes frequencies above the target Nyquist limit.
    size = round(len(samples) * target / rate)
    spectrum = np.fft.rfft(samples)
    output = np.zeros(size // 2 + 1, dtype=complex)
    shared = min(size, len(samples))
    output[:shared // 2 + 1] = spectrum[:shared // 2 + 1]
    if shared % 2 == 0 and size != len(samples):
        output[shared // 2] *= 2 if size < len(samples) else .5
    return np.fft.irfft(output, n=size) * size / len(samples)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('output')
    args = parser.parse_args()
    dest = Path(args.output)
    dest.mkdir(parents=True, exist_ok=True)
    results = []
    for file in sorted(Path(args.source).glob('*.mp3')):
        audio, rate = sf.read(file, always_2d=True)
        audio = resample(audio.mean(axis=1), rate)
        sf.write(dest / (file.stem + '.wav'), np.clip(audio, -1, 1), 16000, subtype='PCM_16')
        results.append({'name': file.name, 'durationMs': round(len(audio) / 16)})
    print(json.dumps({'decoded': len(results), 'minMs': min(r['durationMs'] for r in results), 'maxMs': max(r['durationMs'] for r in results)}))

if __name__ == '__main__':
    main()
