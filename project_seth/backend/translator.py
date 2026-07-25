import logging

logger = logging.getLogger(__name__)

MAX_CHUNK = 4500  # deep-translator / Google Translate char limit


def translate_to_tamil(text: str) -> str:
    """Translate *text* to Tamil using Google Translate (no API key needed)."""
    from deep_translator import GoogleTranslator

    translator = GoogleTranslator(source="auto", target="ta")

    if len(text) <= MAX_CHUNK:
        result = translator.translate(text) or ""
        # Strip leading '5. References' (and common variants) or Tamil '5. குறிப்புகள்' if the translator preserves headings
        import re

        # More robust pattern: match a leading line that starts with '5' and the English or Tamil word for References,
        # allow punctuation and whitespace variants, and avoid \b which doesn't work reliably with Tamil script.
        lead_pattern = re.compile(r"^\s*5[\s\.\:\-\)]*\s*(?:References|குறிப்புகள்)[\s\:\-\)\.]*\r?\n?", flags=re.IGNORECASE)
        result = lead_pattern.sub("", result).strip()
        return result

    # Split long text into chunks and join translations
    chunks = [text[i : i + MAX_CHUNK] for i in range(0, len(text), MAX_CHUNK)]
    translated_chunks = []
    for chunk in chunks:
        try:
            t = translator.translate(chunk) or ""
            # Strip leading '5. References' or Tamil '5. குறிப்புகள்' which sometimes appear when translating
            import re
            lead_pattern = re.compile(r"^\s*5[\s\.\:\-\)]*\s*(?:References|குறிப்புகள்)[\s\:\-\)\.]*\r?\n?", flags=re.IGNORECASE)
            t = lead_pattern.sub("", t).strip()
            translated_chunks.append(t)
        except Exception as exc:
            logger.warning("Chunk translation failed: %s", exc)
            translated_chunks.append(chunk)  # keep original on error

    return " ".join(translated_chunks)
