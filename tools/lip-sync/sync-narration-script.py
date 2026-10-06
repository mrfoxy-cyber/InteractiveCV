"""Export saved ODT narration sections to a browser-readable JSON catalogue."""
import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"


def extract_script(source):
    with zipfile.ZipFile(source) as document:
        root = ET.fromstring(document.read("content.xml"))
    sections = []
    current = None
    for node in root.iter():
        if node.tag not in (TEXT + "p", TEXT + "h"):
            continue
        text = "".join(node.itertext()).strip()
        match = re.search(r"^(.+?)\s+[—–-]\s+([^/\\]+\.mp3)\s*$", text, re.IGNORECASE)
        if match:
            current = {"file": match.group(2).strip(), "title": match.group(1).strip(), "paragraphs": []}
            sections.append(current)
        elif text and current is not None:
            # This heading separates sections; it is not part of Languages speech.
            if text == "Reusable navigation prompts":
                current = None
            else:
                current["paragraphs"].append(text)
    clips = [{"file": section["file"], "title": section["title"], "text": "\n\n".join(section["paragraphs"])}
             for section in sections if section["paragraphs"]]
    if not clips or len({clip["file"] for clip in clips}) != len(clips):
        raise ValueError("No unique narration sections found; expected headings such as Welcome — welcome.mp3.")
    return {"version": 1, "language": "en", "source": "script.odt", "clips": clips}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    project = Path(__file__).resolve().parents[2]
    parser.add_argument("--source", type=Path, default=project / "dist/assets/cv/interactive/audiotour/script.odt")
    parser.add_argument("--output", type=Path, default=project / "dist/character-map/narration-scripts.json")
    args = parser.parse_args()
    try:
        catalogue = extract_script(args.source)
        args.output.write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated narration text: {len(catalogue['clips'])} script sections.")
    except (OSError, ValueError, zipfile.BadZipFile, ET.ParseError) as error:
        # The committed browser-readable copy remains useful on a clean clone,
        # where the private source document is deliberately ignored by Git.
        print(f"Could not refresh the saved ODT script: {error}. Keeping the existing script catalogue.")


if __name__ == "__main__":
    main()
