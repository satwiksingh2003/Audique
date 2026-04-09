"""
language_utils.py
-----------------
Centralised list of languages supported by Whisper large-v3 (via Groq).
This is used by:
  - /languages endpoint  → to populate the frontend dropdown
  - transcribe.py        → for validation
  - notes_generator.py   → for language-aware prompts

Whisper large-v3 supports 99 languages. We expose the most relevant ones
for Phase 1 (Indian + major global languages), with all others available
under the "Other / Auto-detect" option.
"""

# BCP-47 code → human-readable display name
SUPPORTED_LANGUAGES: list[dict] = [
    # Auto-detect (recommended default)
    {"code": "auto",  "name": "Auto-detect", "flag": "🌐"},

    # Indian languages (high priority for Audique's primary user base)
    {"code": "hi",    "name": "Hindi",       "flag": "🇮🇳"},
    {"code": "ta",    "name": "Tamil",       "flag": "🇮🇳"},
    {"code": "te",    "name": "Telugu",      "flag": "🇮🇳"},
    {"code": "kn",    "name": "Kannada",     "flag": "🇮🇳"},
    {"code": "ml",    "name": "Malayalam",   "flag": "🇮🇳"},
    {"code": "bn",    "name": "Bengali",     "flag": "🇧🇩"},
    {"code": "mr",    "name": "Marathi",     "flag": "🇮🇳"},
    {"code": "gu",    "name": "Gujarati",    "flag": "🇮🇳"},
    {"code": "pa",    "name": "Punjabi",     "flag": "🇮🇳"},
    {"code": "ur",    "name": "Urdu",        "flag": "🇵🇰"},
    {"code": "or",    "name": "Odia",        "flag": "🇮🇳"},

    # Major global languages
    {"code": "en",    "name": "English",     "flag": "🇬🇧"},
    {"code": "es",    "name": "Spanish",     "flag": "🇪🇸"},
    {"code": "fr",    "name": "French",      "flag": "🇫🇷"},
    {"code": "de",    "name": "German",      "flag": "🇩🇪"},
    {"code": "zh",    "name": "Chinese",     "flag": "🇨🇳"},
    {"code": "ar",    "name": "Arabic",      "flag": "🇸🇦"},
    {"code": "pt",    "name": "Portuguese",  "flag": "🇧🇷"},
    {"code": "ru",    "name": "Russian",     "flag": "🇷🇺"},
    {"code": "ja",    "name": "Japanese",    "flag": "🇯🇵"},
    {"code": "ko",    "name": "Korean",      "flag": "🇰🇷"},
    {"code": "it",    "name": "Italian",     "flag": "🇮🇹"},
    {"code": "tr",    "name": "Turkish",     "flag": "🇹🇷"},
    {"code": "vi",    "name": "Vietnamese",  "flag": "🇻🇳"},
    {"code": "id",    "name": "Indonesian",  "flag": "🇮🇩"},
    {"code": "fa",    "name": "Persian",     "flag": "🇮🇷"},
    {"code": "nl",    "name": "Dutch",       "flag": "🇳🇱"},
    {"code": "pl",    "name": "Polish",      "flag": "🇵🇱"},
    {"code": "sv",    "name": "Swedish",     "flag": "🇸🇪"},
    {"code": "th",    "name": "Thai",        "flag": "🇹🇭"},
]

# Lookup set for fast validation
_VALID_CODES = {lang["code"] for lang in SUPPORTED_LANGUAGES}


def detect_language_from_code(code: str | None) -> dict | None:
    """Return the language entry for a given BCP-47 code, or None if not found."""
    if code is None:
        return None
    return next((lang for lang in SUPPORTED_LANGUAGES if lang["code"] == code), None)


def validate_language_code(code: str | None) -> bool:
    """Return True if the code is in our supported list or is None (auto-detect)."""
    if code is None or code == "auto":
        return True
    return code in _VALID_CODES