import base64
import io
import logging

logger = logging.getLogger(__name__)


def text_to_speech_b64(text: str, lang: str = "ta") -> str:
    """Convert *text* to speech using gTTS and return a base64-encoded MP3 string."""
    # Remove a leading '5. References' or Tamil '5. குறிப்புகள்' to avoid reading the heading aloud
    import re
    lead_pattern = re.compile(r"^\s*5[\s\.\:\-\)]*\s*(?:References|குறிப்புகள்)[\s\:\-\)\.]*\r?\n?", flags=re.IGNORECASE)
    text = lead_pattern.sub("", text).strip()

    from gtts import gTTS

    tts = gTTS(text=text, lang=lang, slow=False)
    buffer = io.BytesIO()
    tts.write_to_fp(buffer)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")
