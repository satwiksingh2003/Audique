"""
notes_generator.py
------------------
Generates structured notes, summaries, and flashcards from a transcript.

Multilanguage improvement:
  - All prompts include the detected_language so the LLM responds in the
    same language as the lecture — not forced into English.
  - Uses llama-3.3-70b-versatile via Groq for broad language support.
"""

import logging
import json

logger = logging.getLogger(__name__)

LLM_MODEL = "llama-3.3-70b-versatile"
MAX_TOKENS = 2048


def _chat(groq_client, system_prompt: str, user_content: str) -> str:
    """Helper to call Groq chat completion and return the assistant text."""
    response = groq_client.chat.completions.create(
        model=LLM_MODEL,
        max_tokens=MAX_TOKENS,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def generate_notes(transcript: str, language: str, groq_client) -> str:
    """
    Convert a transcript into structured study notes.

    The output language matches the lecture language (e.g. Hindi notes for
    a Hindi lecture, Tamil notes for a Tamil lecture, etc.).
    """
    system_prompt = (
        f"You are an expert educational assistant. "
        f"The following lecture was delivered in language code '{language}'. "
        f"Generate clear, well-structured study notes IN THE SAME LANGUAGE as the lecture. "
        f"Use headings, bullet points, and highlight key terms. "
        f"Do not translate the content — keep it in '{language}'."
    )

    user_content = (
        f"Here is the lecture transcript:\n\n{transcript}\n\n"
        f"Please generate comprehensive, structured study notes."
    )

    logger.info(f"Generating notes in language: {language}")
    return _chat(groq_client, system_prompt, user_content)


def generate_summary(transcript: str, language: str, groq_client) -> str:
    """
    Generate a concise summary of the lecture in the same language.
    """
    system_prompt = (
        f"You are an expert educational assistant. "
        f"The lecture was in language code '{language}'. "
        f"Write a concise summary (5–8 sentences) of the lecture IN THE SAME LANGUAGE ('{language}'). "
        f"Focus on the most important concepts and conclusions. "
        f"Do not translate — respond in '{language}'."
    )

    user_content = (
        f"Lecture transcript:\n\n{transcript}\n\n"
        f"Please provide a concise summary."
    )

    logger.info(f"Generating summary in language: {language}")
    return _chat(groq_client, system_prompt, user_content)


def generate_flashcards(transcript: str, language: str, groq_client) -> list[dict]:
    """
    Generate Q&A flashcards from the transcript.

    Returns a list of dicts: [{"question": "...", "answer": "..."}, ...]
    Both question and answer are in the lecture's language.
    """
    system_prompt = (
        f"You are an expert educational assistant. "
        f"The lecture was in language code '{language}'. "
        f"Generate 8–12 flashcard-style Q&A pairs IN THE SAME LANGUAGE as the lecture ('{language}'). "
        f"Return ONLY a valid JSON array with objects having 'question' and 'answer' keys. "
        f"Example format: [{{'question': '...', 'answer': '...'}}]. "
        f"Do not include any text outside the JSON array."
    )

    user_content = (
        f"Lecture transcript:\n\n{transcript}\n\n"
        f"Generate flashcards as a JSON array."
    )

    logger.info(f"Generating flashcards in language: {language}")
    raw = _chat(groq_client, system_prompt, user_content)

    try:
        # Strip potential markdown code fences
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        flashcards = json.loads(clean.strip())
        if isinstance(flashcards, list):
            return flashcards
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse flashcards as JSON, returning raw text")

    # Fallback: wrap raw text as a single item
    return [{"question": "Lecture Notes", "answer": raw}]