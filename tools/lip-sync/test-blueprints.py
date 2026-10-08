import base64
import io
import json
from pathlib import Path
import tempfile
import unittest
import wave
import server

class BlueprintTests(unittest.TestCase):
    def payload(self):
        data = io.BytesIO()
        with wave.open(data, 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(16000)
            audio.writeframes(b'\x00\x00' * 16000)
        return {'audioBase64': base64.b64encode(data.getvalue()).decode(),
                'report': {'schemaVersion': 1, 'label': '../../outside',
                           'pattern': {'chunks': [], 'trace': []},
                           'frequencyAnalysis': {'mfcc': {'chunks': [], 'recordingFingerprint': None}}}}

    def test_query_does_not_train(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'dist'
            root.mkdir()
            payload = self.payload()
            payload['report']['kind'] = 'command-match-test'
            result = server.save_chunk_test(payload, root)
            self.assertIsNone(result['blueprintFolder'])
            self.assertTrue((Path(temp) / result['folder'] / 'recording.wav').is_file())
            self.assertFalse((Path(temp) / 'commands').exists())

    def test_pair_and_safe_path(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'dist'
            root.mkdir()
            payload = self.payload()
            result = server.save_chunk_test(payload, root)
            folder = Path(temp) / result['blueprintFolder']
            self.assertTrue(folder.is_relative_to(Path(temp) / 'commands' / 'blueprints'))
            data = json.loads((folder / 'blueprint.json').read_text())
            self.assertEqual(data['audioFile'], 'recording.wav')
            self.assertEqual(data['durationMs'], 1000)
            self.assertEqual(data['chunkCount'], 0)
            self.assertEqual((folder / 'recording.wav').read_bytes(), base64.b64decode(payload['audioBase64']))
            second = server.save_chunk_test(self.payload(), root)
            self.assertNotEqual(result['blueprintFolder'], second['blueprintFolder'])

if __name__ == '__main__':
    unittest.main()
