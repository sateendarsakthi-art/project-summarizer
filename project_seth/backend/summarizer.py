import logging
import re


from transformers import pipeline

logger = logging.getLogger(__name__)

_summarizer = None
_model_load_error = None

MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"


def _get_summarizer():
    global _summarizer, _model_load_error

    if _summarizer is not None:
        return _summarizer

    if _model_load_error is not None:
        raise RuntimeError(_model_load_error)

    try:
        _summarizer = pipeline(
            "text-generation",
            model=MODEL_NAME,
            device=-1,
        )
        return _summarizer
    except Exception as exc:
        _model_load_error = str(exc)
        logger.warning("Could not load %s: %s", MODEL_NAME, exc)
        raise


def chunk_text(text, size=2500, max_chunks=4):
    chunks = [text[i : i + size] for i in range(0, len(text), size)]
    if len(chunks) > max_chunks:
        # Take the first (max_chunks - 1) chunks and the last chunk
        front = max_chunks - 1
        return chunks[:front] + chunks[-1:]
    return chunks


def _truncate(text, limit=1200):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3].rsplit(" ", 1)[0] + "..."


def _first_sentence(text, max_len=150):
    """Extract the first sentence from text, capped at max_len chars."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    # Try to find first sentence-ending punctuation
    m = re.search(r"[.!?](?:\s|$)", text)
    if m and m.end() <= max_len:
        return text[: m.end()].strip()
    # No sentence boundary within limit — hard truncate
    if len(text) <= max_len:
        return text
    return text[: max_len - 3].rsplit(" ", 1)[0] + "..."


def _ensure_concise(long_summary, short_summary):
    """Guarantee the short summary is meaningfully shorter than the long one.

    If the candidate short_summary is missing or not at least 40 % shorter,
    rebuild it by pulling the first sentence out of each section in the
    long summary.  For unstructured text (no section headers), split into
    paragraphs and take the first sentence of each.
    """
    if not long_summary:
        return short_summary or ""

    # Already good?
    if short_summary and len(short_summary) < len(long_summary) * 0.6:
        return short_summary

    # ── Strategy 1: structured (has section headers) ──────────────────
    section_defs = [
        {"label": "1. Objective",     "pattern": r"(?:1\.?\s*)?Objective\b\s*:?"},
        {"label": "2. Methodology",   "pattern": r"(?:2\.?\s*)?Methodology\b\s*:?"},
        {"label": "3. Key Findings",  "pattern": r"(?:3\.?\s*)?(?:Key\s+)?Findings\b\s*:?"},
        {"label": "4. Conclusion",    "pattern": r"(?:4\.?\s*)?Conclusion\b\s*:?"},
    ]

    matches = []
    for sec in section_defs:
        match = re.search(sec["pattern"], long_summary, re.IGNORECASE)
        if match:
            matches.append({"label": sec["label"], "start": match.start(), "end": match.end()})

    matches.sort(key=lambda x: x["start"])

    concise_parts = []
    for i, curr in enumerate(matches):
        next_match = matches[i + 1] if i + 1 < len(matches) else None
        start_idx = curr["end"]
        end_idx = next_match["start"] if next_match else len(long_summary)
        content = long_summary[start_idx:end_idx].strip()
        content = re.sub(r"^[:\-\s\n]+", "", content).strip()
        if content:
            concise_parts.append(f"{curr['label']}\n{_first_sentence(content)}")

    if concise_parts:
        return "\n\n".join(concise_parts)

    # ── Strategy 2: unstructured (no section headers found) ───────────
    # Split into paragraphs and take the first sentence of each.
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", long_summary) if p.strip()]
    if paragraphs:
        condensed = []
        for para in paragraphs:
            # Preserve a leading label (e.g. "Background Information:") if present
            label_match = re.match(r"^([A-Z][^:\n]{2,40})\s*:\s*", para)
            if label_match:
                label = label_match.group(1).strip()
                body = para[label_match.end():].strip()
                condensed.append(f"{label}: {_first_sentence(body, max_len=120)}")
            else:
                condensed.append(_first_sentence(para, max_len=120))
        result = "\n\n".join(condensed)
        # Only use this if it's actually shorter
        if len(result) < len(long_summary) * 0.7:
            return result

    # ── Final fallback: take first + last sentence ────────────────────
    sentences = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", long_summary).strip())
    if len(sentences) >= 3:
        return f"{sentences[0]} ... {sentences[-1]}"
    return _truncate(long_summary, 500)


def _find_section(text, headers, stop_headers):
    header_pattern = "|".join(headers)
    stop_pattern = "|".join(stop_headers) if stop_headers else None

    if stop_pattern:
        pattern = (
            rf"(?is)(?:^|\n)\s*(?:{header_pattern})\s*\n"
            rf"(.*?)"
            rf"(?=\n\s*(?:{stop_pattern})\s*(?:\n|$)|\Z)"
        )
    else:
        pattern = rf"(?is)(?:^|\n)\s*(?:{header_pattern})\s*\n(.*)"

    match = re.search(pattern, text)
    if not match:
        return ""

    return _truncate(match.group(1).strip())


def summarize_with_heuristics(text):
    objective = _find_section(
        text,
        [r"abstract", r"introduction", r"1\.?\s*introduction", r"objective"],
        [r"method", r"related work", r"background", r"2\.?\s"],
    )
    methodology = _find_section(
        text,
        [r"method(?:ology|s)?", r"materials and methods", r"approach", r"experimental setup"],
        [r"results?", r"findings?", r"discussion", r"evaluation"],
    )
    findings = _find_section(
        text,
        [r"results?", r"findings?", r"key findings", r"discussion"],
        [r"conclusion", r"future work", r"references"],
    )
    conclusion = _find_section(
        text,
        [r"conclusion", r"conclusions", r"summary and conclusion"],
        [r"references", r"acknowledg"],
    )

    if not any([objective, methodology, findings, conclusion]):
        intro = _truncate(text, 800)
        objective = intro
        methodology = _truncate(text[800:2400], 800) if len(text) > 800 else ""
        findings = _truncate(text[2400:4000], 800) if len(text) > 2400 else ""
        conclusion = _truncate(text[-1200:], 800) if len(text) > 1200 else ""

    parts = []
    if objective:
        parts.append(f"1. Objective\n{objective}")
    if methodology:
        parts.append(f"2. Methodology\n{methodology}")
    if findings:
        parts.append(f"3. Key Findings\n{findings}")
    if conclusion:
        parts.append(f"4. Conclusion\n{conclusion}")

    long_summary = "\n\n".join(parts)
    
    # Concise version: first sentence only per section
    short_parts = []
    if objective:
        short_parts.append(f"1. Objective\n{_first_sentence(objective)}")
    if methodology:
        short_parts.append(f"2. Methodology\n{_first_sentence(methodology)}")
    if findings:
        short_parts.append(f"3. Key Findings\n{_first_sentence(findings)}")
    if conclusion:
        short_parts.append(f"4. Conclusion\n{_first_sentence(conclusion)}")

    short_summary = "\n\n".join(short_parts)

    return {
        "summary": long_summary,
        "short_summary": _ensure_concise(long_summary, short_summary)
    }


def clean_summary_text(text):
    if not text:
        return ""

    # 1. Strip out initial "5. References" (with potential markdown, colons, or spacing) if it occurs at the beginning of the text
    text = re.sub(r"^\s*(?:[#*_\-\[s]*\s*5\s*[\.:\-]?\s*References?\b[#*_\-\]s]*\s*:?\s*)", "", text, flags=re.IGNORECASE).strip()

    # 2. Find the sections using regex.
    sections = [
        {"key": "objective", "label": "1. Objective", "pattern": r"(?:1\.?\s*)?Objective\b\s*:?"},
        {"key": "methodology", "label": "2. Methodology", "pattern": r"(?:2\.?\s*)?Methodology\b\s*:?"},
        {"key": "findings", "label": "3. Key Findings", "pattern": r"(?:3\.?\s*)?(?:Key\s+)?Findings\b\s*:?"},
        {"key": "conclusion", "label": "4. Conclusion", "pattern": r"(?:4\.?\s*)?Conclusion\b\s*:?"},
    ]

    matches = []
    for sec in sections:
        match = re.search(sec["pattern"], text, re.IGNORECASE)
        if match:
            matches.append({
                "key": sec["key"],
                "label": sec["label"],
                "start": match.start(),
                "end": match.end()
            })

    matches.sort(key=lambda x: x["start"])

    parsed_sections = []
    for i, curr in enumerate(matches):
        next_match = matches[i + 1] if i + 1 < len(matches) else None
        
        start_idx = curr["end"]
        end_idx = next_match["start"] if next_match else len(text)
        
        content = text[start_idx:end_idx].strip()
        
        if not next_match:
            cutoff_match = re.search(r"(?:References:|\[1\]|\bI apologize\b|\bThank you\b)", content, re.IGNORECASE)
            if cutoff_match:
                content = content[:cutoff_match.start()].strip()
        
        content = re.sub(r"^[:\-\s\n]+", "", content)
        content = re.sub(r"[:\-\s\n]+$", "", content).strip()
        
        if content:
            parsed_sections.append(f"{curr['label']}\n{content}")

    if parsed_sections:
        return "\n\n".join(parsed_sections)
    
    text = re.sub(r"(?i)(?:References:|\[1\]|\bI apologize\b|\bThank you\b)[\s\S]*$", "", text)
    return text.strip()


def _summarize_with_llm(text):
    summarizer = _get_summarizer()
    chunks = chunk_text(text)
    chunk_summaries = []

    for chunk in chunks:
        prompt = f"""You are a research summarization assistant. Summarize this section of a research paper.

Text:
{chunk}

Extract detailed information and provide a comprehensive summary with multiple sentences for:
1. Objective
2. Methodology
3. Key Findings

DO NOT include any conversational filler, introduction, apologies, or bibliography/references.
"""
        result = summarizer(
            prompt,
            max_new_tokens=250,
            temperature=0.2,
        )
        generated = result[0]["generated_text"]
        # Strip the prompt prefix — pipeline returns prompt + new tokens
        if generated.startswith(prompt):
            generated = generated[len(prompt):].strip()
        chunk_summaries.append(generated)

    combined = "\n".join(chunk_summaries)

    final_prompt = f"""You are a research summarization assistant. Create a detailed and comprehensive final research paper summary based on the following text chunks.

Chunks:
{combined}

Format your output EXACTLY as follows:
1. Objective
[3-4 sentences explaining the objective]

2. Methodology
[3-4 sentences explaining the methodology]

3. Key Findings
[3-4 sentences explaining key findings]

4. Conclusion
[3-4 sentences explaining conclusion]

DO NOT include any introduction, conversational filler, greetings, apologies, or bibliography/references.
"""
    final = summarizer(
        final_prompt,
        max_new_tokens=800,
        temperature=0.25,
    )

    generated = final[0]["generated_text"]
    if generated.startswith(final_prompt):
        generated = generated[len(final_prompt):].strip()
        
    long_summary = clean_summary_text(generated)
    
    # ── Short Summary Pass ──
    short_prompt = f"""You are a research summarization assistant. Create a VERY CONCISE research paper summary based on the following text chunks.

Chunks:
{combined}

Format your output EXACTLY as follows:
1. Objective
[1 sentence explaining the objective]

2. Methodology
[1 sentence explaining the methodology]

3. Key Findings
[1 sentence explaining key findings]

4. Conclusion
[1 sentence explaining conclusion]

DO NOT include any introduction, conversational filler, greetings, apologies, or bibliography/references.
"""
    short_final = summarizer(
        short_prompt,
        max_new_tokens=400,
        temperature=0.2,
    )
    
    short_generated = short_final[0]["generated_text"]
    if short_generated.startswith(short_prompt):
        short_generated = short_generated[len(short_prompt):].strip()
        
    short_summary = clean_summary_text(short_generated)
    
    return {
        "summary": long_summary,
        "short_summary": _ensure_concise(long_summary, short_summary)
    }


def summarize_paper(text):
    if not text or not text.strip():
        raise ValueError("No text could be extracted from the PDF.")

    try:
        return _summarize_with_llm(text)
    except Exception as exc:
        logger.warning("LLM summarization unavailable, using heuristic fallback: %s", exc)
        return summarize_with_heuristics(text)
