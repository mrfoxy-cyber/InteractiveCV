import base64
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave
import server


def wav_payload():
    data = io.BytesIO()
    with wave.open(data, "wb") as recording:
        recording.setnchannels(1)
        recording.setsampwidth(2)
        recording.setframerate(16000)
        recording.writeframes(b"\x00\x00" * 16000)
    return {"filename": "welcome.mp3", "audioBase64": base64.b64encode(data.getvalue()).decode("ascii")}


class PipelineTests(unittest.TestCase):
    def raw(self):
        return {"metadata": {"duration": 1, "soundFile": "private/temp.wav"},
                "mouthCues": [{"start": 0, "end": .5, "value": "D"}, {"start": .5, "end": 1, "value": "X"}]}

    def test_mapping_and_privacy(self):
        output = server.convert_cues(self.raw(), "welcome.mp3", "phonetic")
        self.assertEqual(output["mouthCues"], [{"startMs": 0, "endMs": 500, "pose": "aei", "sourceShape": "D"},
                                             {"startMs": 500, "endMs": 1000, "pose": "rest", "sourceShape": "X"}])
        self.assertNotIn("private", json.dumps(output))
        self.assertEqual(set(server.SHAPES), set("ABCDEFGHX"))

    def test_invalid_cues_rejected(self):
        for field, value in [("start", .1), ("end", float("nan")), ("value", "Q"), ("end", 2)]:
            raw = self.raw(); raw["mouthCues"][0][field] = value
            with self.assertRaises(ValueError): server.convert_cues(raw, "welcome.mp3", "phonetic")
        raw = self.raw(); raw["mouthCues"].pop()
        with self.assertRaises(ValueError): server.convert_cues(raw, "welcome.mp3", "phonetic")

    def test_bad_input(self):
        for payload in [{}, {"filename": "x", "audioBase64": "!"},
                        {**wav_payload(), "recognizer": "unknown"},
                        {**wav_payload(), "script": "hello", "recognizer": "phonetic"}]:
            with self.assertRaises(ValueError): server.analyze(payload, Path("missing.exe"))

    def test_recognition_and_cleanup(self):
        captured = []
        def run(args, **kwargs):
            captured.append(Path(args[-1]))
            self.assertTrue(captured[-1].is_file())
            self.assertNotIn("-d", args)
            Path(args[args.index("-o") + 1]).write_text(json.dumps(self.raw()), encoding="utf-8")
            return type("Result", (), {"returncode": 0, "stdout": json.dumps(self.raw())})()
        with tempfile.TemporaryDirectory() as folder:
            executable = Path(folder) / "rhubarb.exe"; executable.touch()
            with patch("server.subprocess.run", side_effect=run):
                output = server.analyze(wav_payload(), executable)
            self.assertEqual(output["audioFile"], "welcome.mp3")
        self.assertFalse(captured[0].parent.exists())

    def test_failure_cleans_up(self):
        captured = []
        def run(args, **kwargs):
            captured.append(Path(args[-1]))
            return type("Result", (), {"returncode": 1})()
        with tempfile.TemporaryDirectory() as folder:
            executable = Path(folder) / "rhubarb.exe"; executable.touch()
            with patch("server.subprocess.run", side_effect=run), self.assertRaises(RuntimeError):
                server.analyze(wav_payload(), executable)
        self.assertFalse(captured[0].parent.exists())

    def test_optional_english_script(self):
        def run(args, **kwargs):
            self.assertEqual(Path(args[args.index("-d") + 1]).read_text(encoding="utf-8"), "Hello Marju")
            self.assertIn("pocketSphinx", args)
            Path(args[args.index("-o") + 1]).write_text(json.dumps(self.raw()), encoding="utf-8")
            return type("Result", (), {"returncode": 0, "stdout": json.dumps(self.raw())})()
        with tempfile.TemporaryDirectory() as folder:
            executable = Path(folder) / "rhubarb.exe"; executable.touch()
            with patch("server.subprocess.run", side_effect=run):
                server.analyze({**wav_payload(), "recognizer": "pocketSphinx", "script": "Hello Marju"}, executable)


if __name__ == "__main__": unittest.main()
