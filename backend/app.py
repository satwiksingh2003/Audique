import os
import uuid
import tempfile
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq
from pydub import AudioSegment

from transcribe import transcribe_audio
from notes_generator import generate_notes, generate_summary, generate_flashcards
from language_utils import SUPPORTED_LANGUAGES, detect_language_from_code

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {"wav", "mp3", "mp4", "m4a", "webm", "ogg", "flac", "mpeg", "mpga"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "2.0.0", "multilang": True})


@app.route("/languages", methods=["GET"])
def get_supported_languages():
    """Return all supported languages for the frontend dropdown."""
    return jsonify({
        "languages": SUPPORTED_LANGUAGES,
        "default": "auto"
    })


@app.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Transcribe uploaded audio with optional language hint.

    Form fields:
        audio      : audio file (required)
        language   : BCP-47 language code e.g. 'hi', 'ta', 'en' (optional, default=auto)
        response_format : 'json' | 'verbose_json' (optional, default='verbose_json')
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(audio_file.filename):
        return jsonify({"error": f"Unsupported file type. Allowed: {ALLOWED_EXTENSIONS}"}), 400

    # Optional language hint from the frontend
    language = request.form.get("language", None)
    if language == "auto" or language == "":
        language = None  # Whisper will auto-detect

    response_format = request.form.get("response_format", "verbose_json")

    # Save uploaded file to temp path
    ext = audio_file.filename.rsplit(".", 1)[1].lower()
    temp_filename = f"{uuid.uuid4()}.{ext}"
    temp_path = os.path.join(UPLOAD_FOLDER, temp_filename)

    try:
        audio_file.save(temp_path)
        logger.info(f"Saved audio to {temp_path}, language hint: {language or 'auto-detect'}")

        result = transcribe_audio(
            audio_path=temp_path,
            language=language,
            response_format=response_format,
            groq_client=groq_client,
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.route("/generate-notes", methods=["POST"])
def generate_notes_endpoint():
    """
    Generate structured notes from a transcript.

    JSON body:
        transcript     : string (required)
        language       : BCP-47 language code (optional, uses detected_language if omitted)
        detected_language : language returned by /transcribe (optional)
    """
    data = request.get_json()
    if not data or "transcript" not in data:
        return jsonify({"error": "transcript is required"}), 400

    transcript = data["transcript"]
    # Prefer explicit language, fall back to detected, then default English
    language = data.get("language") or data.get("detected_language") or "en"

    try:
        notes = generate_notes(transcript, language, groq_client)
        return jsonify({"notes": notes, "language": language})
    except Exception as e:
        logger.error(f"Notes generation error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/generate-summary", methods=["POST"])
def generate_summary_endpoint():
    data = request.get_json()
    if not data or "transcript" not in data:
        return jsonify({"error": "transcript is required"}), 400

    transcript = data["transcript"]
    language = data.get("language") or data.get("detected_language") or "en"

    try:
        summary = generate_summary(transcript, language, groq_client)
        return jsonify({"summary": summary, "language": language})
    except Exception as e:
        logger.error(f"Summary generation error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/generate-flashcards", methods=["POST"])
def generate_flashcards_endpoint():
    data = request.get_json()
    if not data or "transcript" not in data:
        return jsonify({"error": "transcript is required"}), 400

    transcript = data["transcript"]
    language = data.get("language") or data.get("detected_language") or "en"

    try:
        flashcards = generate_flashcards(transcript, language, groq_client)
        return jsonify({"flashcards": flashcards, "language": language})
    except Exception as e:
        logger.error(f"Flashcard generation error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)