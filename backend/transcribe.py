"""
transcribe.py
-------------
Handles audio preprocessing and transcription via Groq's Whisper large-v3 API.

Key improvements over the original:
  - Uses whisper-large-v3 (best multilingual accuracy) instead of smaller models
  - Accepts an explicit language hint so non-English audio is not forced through English decoding
  - Auto-detects language when no hint is provided (language=None)
  - Preprocesses audio to 16 kHz mono WAV for optimal Whisper performance
  - Chunks audio files that exceed Groq's 25 MB limit
  - Returns detected_language in the response so downstream LLM prompts stay language-aware
"""

import os
import math
import logging
import tempfile

from pydub import AudioSegment

logger = logging.getLogger(__name__)

# Groq supports whisper-large-v3 and whisper-large-v3-turbo
# large-v3 has the best word-error-rate across 99 languages
WHISPER_MODEL = "whisper-large-v3"

# Groq hard limit: 25 MB per request
MAX_FILE_BYTES = 24 * 1024 * 1024  # 24 MB to be safe

# Target audio format for best Whisper accuracy
TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1  # mono


def preprocess_audio(input_path: str) -> str:
    """
    Convert audio to 16 kHz mono WAV.
    Returns the path to the preprocessed temp file.
    """
    logger.info(f"Preprocessing audio: {input_path}")
    audio = AudioSegment.from_file(input_path)

    # Normalise: mono + 16 kHz
    audio = audio.set_channels(TARGET_CHANNELS).set_frame_rate(TARGET_SAMPLE_RATE)

    # Normalise volume to -20 dBFS (helps Whisper on quiet recordings)
    target_dBFS = -20.0
    change_in_dBFS = target_dBFS - audio.dBFS
    audio = audio.apply_gain(change_in_dBFS)

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    audio.export(tmp.name, format="wav")
    logger.info(f"Preprocessed audio saved to: {tmp.name}")
    return tmp.name


def _chunk_audio(audio_path: str):
    """
    Yield temp WAV file paths for chunks that fit within MAX_FILE_BYTES.
    Used when the preprocessed file exceeds Groq's limit.
    """
    audio = AudioSegment.from_file(audio_path)
    duration_ms = len(audio)
    file_size = os.path.getsize(audio_path)

    if file_size <= MAX_FILE_BYTES:
        yield audio_path
        return

    # Calculate how many equal chunks we need
    n_chunks = math.ceil(file_size / MAX_FILE_BYTES)
    chunk_ms = duration_ms // n_chunks
    logger.info(f"Splitting audio into {n_chunks} chunks of ~{chunk_ms / 1000:.1f}s each")

    for i in range(n_chunks):
        start = i * chunk_ms
        end = min((i + 1) * chunk_ms, duration_ms)
        chunk = audio[start:end]

        tmp = tempfile.NamedTemporaryFile(suffix=f"_chunk{i}.wav", delete=False)
        chunk.export(tmp.name, format="wav")
        logger.info(f"  Chunk {i+1}/{n_chunks}: {tmp.name}")
        yield tmp.name


def transcribe_audio(
    audio_path: str,
    language: str | None,
    response_format: str,
    groq_client,
) -> dict:
    """
    Transcribe audio using Groq Whisper large-v3.

    Parameters
    ----------
    audio_path : str
        Path to the uploaded audio file.
    language : str | None
        BCP-47 language code (e.g. 'hi', 'ta', 'en') or None for auto-detect.
    response_format : str
        'json' or 'verbose_json'. Use 'verbose_json' to get word-level timestamps.
    groq_client : groq.Groq
        Initialised Groq client.

    Returns
    -------
    dict with keys:
        transcript       : full text
        detected_language: language code detected by Whisper
        segments         : list of segment dicts (if verbose_json)
        duration_seconds : total audio duration
    """
    preprocessed_path = preprocess_audio(audio_path)

    try:
        full_text_parts = []
        all_segments = []
        detected_language = language or "unknown"
        total_duration = 0.0

        for chunk_path in _chunk_audio(preprocessed_path):
            try:
                with open(chunk_path, "rb") as f:
                    transcription = groq_client.audio.transcriptions.create(
                        file=(os.path.basename(chunk_path), f),
                        model=WHISPER_MODEL,
                        language=language,           # None = auto-detect
                        response_format=response_format,
                        temperature=0.0,             # Deterministic output
                    )

                # verbose_json returns an object with .text, .language, .segments
                if hasattr(transcription, "text"):
                    full_text_parts.append(transcription.text)
                    if hasattr(transcription, "language") and transcription.language:
                        detected_language = transcription.language
                    if hasattr(transcription, "segments") and transcription.segments:
                        all_segments.extend(transcription.segments)
                    if hasattr(transcription, "duration"):
                        total_duration += transcription.duration or 0.0
                else:
                    # plain json just returns a string-like object
                    full_text_parts.append(str(transcription))

            finally:
                # Clean up chunk temp files (but not the original preprocessed file)
                if chunk_path != preprocessed_path and os.path.exists(chunk_path):
                    os.remove(chunk_path)

        full_transcript = " ".join(full_text_parts).strip()
        logger.info(
            f"Transcription complete. Language: {detected_language}, "
            f"chars: {len(full_transcript)}"
        )

        return {
            "transcript": full_transcript,
            "detected_language": detected_language,
            "segments": all_segments,
            "duration_seconds": round(total_duration, 2),
            "model": WHISPER_MODEL,
        }

    finally:
        if os.path.exists(preprocessed_path):
            os.remove(preprocessed_path)
            