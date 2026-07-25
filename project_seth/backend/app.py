import logging
import os
import traceback

from flask import Flask, jsonify, request
from flask_cors import CORS

from database import init_db, save_summary, get_all_summaries, get_summary_by_id, delete_summary
from pdf_extractor import extract_text
from summarizer import summarize_paper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize DB on startup
init_db()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/summarize", methods=["POST"])
def summarize():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    pdf = request.files["file"]

    if not pdf.filename:
        return jsonify({"error": "No file selected"}), 400

    if not pdf.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are supported"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, pdf.filename)

    try:
        pdf.save(filepath)
        text = extract_text(filepath)

        if not text or not text.strip():
            return jsonify({
                "error": "Could not extract text from this PDF. It may be scanned or image-only."
            }), 422

        summaries = summarize_paper(text)
        
        # Handle backward compatibility in case summarizer returns a string
        if isinstance(summaries, dict):
            long_summary = summaries.get("summary", "")
            short_summary = summaries.get("short_summary", "")
        else:
            long_summary = summaries
            short_summary = summaries

        # Persist to SQLite
        record_id = save_summary(pdf.filename, long_summary, short_summary)

        return jsonify({
            "id": record_id,
            "filename": pdf.filename,
            "summary": long_summary,
            "short_summary": short_summary,
        })
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:
        logger.exception("Summarize failed for %s", pdf.filename)
        return jsonify({"error": f"Summarization failed: {exc}"}), 500
    finally:
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass


@app.route("/history", methods=["GET"])
def history():
    rows = get_all_summaries()
    return jsonify(rows)


@app.route("/history/<int:summary_id>", methods=["GET"])
def history_item(summary_id):
    row = get_summary_by_id(summary_id)
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(row)


@app.route("/history/<int:summary_id>", methods=["DELETE"])
def delete_history_item(summary_id):
    deleted = delete_summary(summary_id)
    if not deleted:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"success": True})


# ─────────────────────────────────────────────
#  Translation endpoint
# ─────────────────────────────────────────────
@app.route("/translate", methods=["POST"])
def translate():
    """Translate English text to Tamil."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided"}), 400

    try:
        from translator import translate_to_tamil
        translated = translate_to_tamil(text)
        return jsonify({"translated": translated})
    except Exception as exc:
        logger.exception("Translation failed")
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────
#  Text-to-Speech endpoint
# ─────────────────────────────────────────────
@app.route("/tts", methods=["POST"])
def tts():
    """Convert text to speech and return base64-encoded MP3."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    lang = data.get("lang", "ta")

    if not text:
        return jsonify({"error": "No text provided"}), 400

    try:
        from tts_engine import text_to_speech_b64
        audio_b64 = text_to_speech_b64(text, lang=lang)
        return jsonify({"audio": audio_b64, "format": "mp3"})
    except Exception as exc:
        logger.exception("TTS failed")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
