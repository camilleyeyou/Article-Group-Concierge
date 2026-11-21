"""Transcribe a wav file with faster-whisper (local, free).

Usage: python transcribe.py <wav> <out.txt>
Writes plain text with [mm:ss] segment stamps.
"""
import sys

from faster_whisper import WhisperModel


def stamp(seconds: float) -> str:
    s = int(seconds)
    return f"[{s // 60:02d}:{s % 60:02d}]"


def main() -> None:
    wav, out = sys.argv[1], sys.argv[2]
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(wav)
    with open(out, "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"{stamp(seg.start)} {seg.text.strip()}\n")


if __name__ == "__main__":
    main()
