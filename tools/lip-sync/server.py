"""Local-only authoring workshop. No third-party Python packages required."""
import argparse
import base64
import io
import json
import math
from pathlib import Path
import secrets
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import subprocess
import tempfile
import threading
import wave

SHAPES = {"A": "bmp", "B": "cdnstxyz", "C": "aei", "D": "aei", "E": "o",
          "F": "u", "G": "fv", "H": "l", "X": "rest"}
MAX_SECONDS = 600
MAX_BODY = 27_000_000


def convert_cues(raw, filename, recognizer):
    duration = raw.get("metadata", {}).get("duration")
    if not isinstance(duration, (int, float)) or not math.isfinite(duration) or not 0 < duration <= MAX_SECONDS:
        raise ValueError("The recognizer returned an invalid duration.")
    duration_ms = round(duration * 1000)
    cues, end_ms = [], 0
    for cue in raw.get("mouthCues", []):
        start, end, shape = cue.get("start"), cue.get("end"), cue.get("value")
        if (not isinstance(start, (int, float)) or not isinstance(end, (int, float))
                or not math.isfinite(start) or not math.isfinite(end) or shape not in SHAPES):
            raise ValueError("The recognizer returned an invalid mouth cue.")
        start_ms, next_end = round(start * 1000), round(end * 1000)
        if start_ms != end_ms or not start_ms < next_end <= duration_ms:
            raise ValueError("The recognizer returned overlapping or incomplete cues.")
        cues.append({"startMs": start_ms, "endMs": next_end, "pose": SHAPES[shape], "sourceShape": shape})
        end_ms = next_end
    if not cues or end_ms != duration_ms:
        raise ValueError("The recognizer returned an incomplete timeline.")
    # Do not export the recognizer's absolute temporary-file path.
    return {"schemaVersion": 1, "audioFile": filename, "durationMs": duration_ms,
            "engine": "Rhubarb Lip Sync 1.14.0", "recognizer": recognizer,
            "mapping": SHAPES, "mouthCues": cues,
            "note": "Approximate visual mouth shapes, not a transcript or exact vowel labels. C and D share the preferred gentle open mouth. Nine recognizer shapes use eight existing poses; the other artwork remains available for manual refinement."}


def analyze(payload, executable):
    recognizer = payload.get("recognizer", "phonetic")
    if recognizer not in ("phonetic", "pocketSphinx"):
        raise ValueError("Choose the English or language-independent recognizer.")
    filename = payload.get("filename", "")
    if not isinstance(filename, str) or not filename or len(filename) > 255:
        raise ValueError("Choose a named audio file.")
    filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
    script = payload.get("script", "")
    if not isinstance(script, str) or len(script) > 50_000:
        raise ValueError("The optional script is too long.")
    if script.strip() and recognizer != "pocketSphinx":
        raise ValueError("The optional script is supported only in English mode.")
    try:
        data = base64.b64decode(payload["audioBase64"], validate=True)
    except (KeyError, ValueError, TypeError) as error:
        raise ValueError("The audio upload is invalid.") from error
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or wav.getframerate() != 16000 or wav.getcomptype() != "NONE":
                raise ValueError("Expected mono 16-bit, 16 kHz WAV audio.")
            seconds = wav.getnframes() / wav.getframerate()
            if not 0.02 <= seconds <= MAX_SECONDS:
                raise ValueError("Use a recording between 20 milliseconds and 10 minutes.")
            if len(wav.readframes(wav.getnframes())) != wav.getnframes() * 2:
                raise ValueError("The WAV recording is truncated.")
    except (wave.Error, EOFError) as error:
        raise ValueError("The WAV recording could not be read.") from error
    if not executable.is_file():
        raise RuntimeError("Rhubarb is missing. See tools/lip-sync/README.md for setup.")
    # Recordings and optional scripts live only in a disposable OS temp folder.
    with tempfile.TemporaryDirectory(prefix="marju-lipsync-") as folder:
        recording = Path(folder) / "recording.wav"
        recording.write_bytes(data)
        output = Path(folder) / "timing.json"
        args = [str(executable), "-r", recognizer, "-f", "json", "-o", str(output), "--extendedShapes", "GHX", "--threads", "2", "--quiet"]
        if script.strip():
            dialog = Path(folder) / "dialog.txt"
            dialog.write_text(script, encoding="utf-8")
            args += ["-d", str(dialog)]
        args.append(str(recording))
        result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", timeout=300,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        if result.returncode:
            raise RuntimeError("The local recognizer could not analyse this recording. Try a clearer voice-only recording.")
        if not output.is_file():
            raise RuntimeError("The local recognizer did not produce a timing file.")
        try:
            raw = json.loads(output.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as error:
            raise RuntimeError("The local recognizer returned an unreadable timing file.") from error
        timeline = convert_cues(raw, filename, recognizer)
        if abs(timeline["durationMs"] - seconds * 1000) > 100:
            raise RuntimeError("The recognizer returned timing for a different duration.")
        return timeline


def make_handler(root, executable, port, token):
    origins = {f"http://127.0.0.1:{port}", f"http://localhost:{port}"}
    hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    busy = threading.Lock()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def send_json(self, status, body):
            encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(encoded)

        def host_allowed(self):
            return self.headers.get("Host") in hosts

        def do_GET(self):
            if not self.host_allowed():
                return self.send_json(403, {"error": "Local workshop access only."})
            if self.path == "/api/status":
                return self.send_json(200, {"ready": executable.is_file(), "token": token,
                                            "maxSeconds": MAX_SECONDS, "engine": "Rhubarb Lip Sync 1.14.0"})
            return super().do_GET()

        def do_HEAD(self):
            if not self.host_allowed():
                return self.send_json(403, {"error": "Local workshop access only."})
            return super().do_HEAD()

        def do_POST(self):
            if (not self.host_allowed() or self.headers.get("Origin") not in origins
                    or not secrets.compare_digest(self.headers.get("X-Workshop-Token", "").encode("utf-8"), token.encode("utf-8"))):
                return self.send_json(403, {"error": "Open the local workshop page before generating a timeline."})
            if self.path != "/api/lipsync":
                return self.send_json(404, {"error": "Unknown endpoint."})
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                size = 0
            if not 0 < size <= MAX_BODY or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.send_json(413, {"error": "Invalid or oversized upload (maximum 10 minutes)."})
            if not busy.acquire(blocking=False):
                return self.send_json(409, {"error": "Another recording is being analysed. Please wait."})
            try:
                self.connection.settimeout(30)
                data = self.rfile.read(size)
                if len(data) != size:
                    raise ValueError("The upload was incomplete.")
                payload = json.loads(data)
                if not isinstance(payload, dict):
                    raise ValueError("Invalid upload.")
                self.send_json(200, analyze(payload, executable))
            except (ValueError, wave.Error) as error:
                self.send_json(400, {"error": str(error)})
            except subprocess.TimeoutExpired:
                self.send_json(504, {"error": "Analysis timed out. Try a shorter voice-only recording."})
            except RuntimeError as error:
                self.send_json(503, {"error": str(error)})
            except (OSError, json.JSONDecodeError):
                self.send_json(500, {"error": "The local analysis failed. No recording was saved."})
            finally:
                busy.release()

        def log_message(self, fmt, *args):
            # No request body, script, recording name or absolute audio path in logs.
            print(fmt % args)

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Run Marju's local audio-to-mouth workshop.")
    parser.add_argument("--port", type=int, default=4180)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2] / "dist")
    parser.add_argument("--rhubarb", type=Path, default=Path(__file__).parent / "vendor" / "Rhubarb-Lip-Sync-1.14.0-Windows" / "rhubarb.exe")
    args = parser.parse_args()
    if not (args.root / "character-map" / "anchored.html").is_file():
        parser.error("Cannot find the character workshop in the website folder.")
    if not args.rhubarb.is_file():
        parser.error("Rhubarb is not installed. See tools/lip-sync/README.md.")
    if not 1024 <= args.port <= 65535:
        parser.error("Use a port between 1024 and 65535.")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(args.root, args.rhubarb.resolve(), args.port, secrets.token_urlsafe(32)))
    print(f"Open http://127.0.0.1:{args.port}/character-map/anchored.html")
    print("Local processing only. Press Ctrl+C to stop the workshop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
