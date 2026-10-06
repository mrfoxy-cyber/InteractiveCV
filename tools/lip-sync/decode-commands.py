import argparse
import json
from pathlib import Path
import sys
parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path);parser.add_argument('output',type=Path);parser.add_argument('decoder',type=Path)
args=parser.parse_args();sys.path.insert(0,str(args.decoder));import miniaudio
args.output.mkdir(parents=True,exist_ok=True)
files=[]
for audio in sorted(args.source.glob('*.mp3')):
    decoded=miniaudio.decode(audio.read_bytes(),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=1,sample_rate=16000)
    target=args.output/(audio.stem+'.f32');target.write_bytes(decoded.samples.tobytes());files.append({'file':audio.name,'pcm':target.name})
(args.output/'files.json').write_text(json.dumps(files,ensure_ascii=False),encoding='utf-8')
print(f'{len(files)} command takes decoded locally.')
