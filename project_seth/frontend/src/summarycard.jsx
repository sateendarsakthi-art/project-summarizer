import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";

/* ── Section metadata ─────────────────────────────────── */
const SECTIONS = [
  {
    key: "objective",
    label: "Objective",
    tamilLabel: "நோக்கம்",
    className: "objective-section",
    pattern: /1\.?\s*Objective\s*\n([\s\S]*?)(?=(?:2\.|\n2\s)|$)/i,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="section-icon">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    key: "methodology",
    label: "Methodology",
    tamilLabel: "முறையியல்",
    className: "methodology-section",
    pattern: /2\.?\s*Methodology\s*\n([\s\S]*?)(?=(?:3\.|\n3\s)|$)/i,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="section-icon">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: "findings",
    label: "Key Findings",
    tamilLabel: "முக்கிய கண்டுபிடிப்புகள்",
    className: "findings-section",
    pattern: /3\.?\s*Key\s*Findings?\s*\n([\s\S]*?)(?=(?:4\.|\n4\s)|$)/i,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="section-icon">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "conclusion",
    label: "Conclusion",
    tamilLabel: "முடிவுரை",
    className: "conclusion-section",
    pattern: /4\.?\s*Conclusion\s*\n([\s\S]*?)$/i,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="section-icon">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
];

function parseSections(text) {
  if (!text) return [];

  let cleanText = text;

  // Remove trailing references/apologies after Conclusion
  const conclusionMatch = cleanText.match(/(?:4\.?\s*)?Conclusion\b/i);
  if (conclusionMatch) {
    const conclusionIndex = conclusionMatch.index;
    const postConclusion = cleanText.slice(conclusionIndex);
    const cutoffMatch = postConclusion.match(/(?:References:|\[1\]|\bI apologize\b|\bThank you\b)/i);
    if (cutoffMatch) {
      const cutoffIndex = conclusionIndex + cutoffMatch.index;
      cleanText = cleanText.slice(0, cutoffIndex).trim();
    }
  }

  // Remove "5. References" at the very beginning (handling markdown/formatting)
  cleanText = cleanText.replace(/^\s*(?:[#*_\-\[s]*\s*5\s*[\.:\-]?\s*References?\b[#*_\-\]s]*\s*:?\s*)/i, "").trim();

  const regexes = {
    objective: /(?:1\.?\s*)?Objective\b\s*:?/i,
    methodology: /(?:2\.?\s*)?Methodology\b\s*:?/i,
    findings: /(?:3\.?\s*)?(?:Key\s+)?Findings\b\s*:?/i,
    conclusion: /(?:4\.?\s*)?Conclusion\b\s*:?/i
  };

  const matches = [];
  for (const sec of SECTIONS) {
    const regex = regexes[sec.key];
    const match = cleanText.match(regex);
    if (match) {
      matches.push({
        ...sec,
        index: match.index,
        length: match[0].length
      });
    }
  }

  matches.sort((a, b) => a.index - b.index);

  const results = [];
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const next = matches[i + 1];

    const startIdx = curr.index + curr.length;
    const endIdx = next ? next.index : cleanText.length;

    let content = cleanText.slice(startIdx, endIdx).trim();
    content = content.replace(/^[:\-\s\n]+/, "").replace(/[:\-\s\n]+$/, "").trim();

    if (content) {
      results.push({
        key: curr.key,
        label: curr.label,
        tamilLabel: curr.tamilLabel,
        className: curr.className,
        icon: curr.icon,
        content: content
      });
    }
  }

  return results;
}

/* ── Language-agnostic section parser ──────────────────── */
/* Matches numbered markers (1., 2.…), English headers,    */
/* AND common Tamil section headers from Google Translate.  */
function parseSectionsByPattern(text) {
  if (!text) return [];

  let cleanText = text.trim();

  // Remove trailing references / apologies
  const refCutoff = cleanText.match(
    /(?:\n\s*(?:5\.\s*)?(?:References?|குறிப்புகள்|மேற்கோள்கள்)\s*:?|\[1\]|\bI apologize\b|\bLet me know\b)/i
  );
  if (refCutoff) cleanText = cleanText.slice(0, refCutoff.index).trim();

  // Section header patterns — matches English, Tamil, and numbered variants
  const patterns = [
    {
      sec: SECTIONS[0], // Objective
      regex: /(?:^|\n)\s*(?:(?:1\.?\s*)?(?:Objective|குறிக்கோள்|நோக்கம்)\s*:?\s*)/i,
    },
    {
      sec: SECTIONS[1], // Methodology
      regex: /(?:^|\n)\s*(?:(?:2\.?\s*)?(?:Methodology|முறை|முறையியல்|வழிமுறை)\s*:?\s*)/i,
    },
    {
      sec: SECTIONS[2], // Key Findings
      regex: /(?:^|\n)\s*(?:(?:3\.?\s*)?(?:(?:Key\s+)?Findings?|முக்கிய\s*கண்டுபிடிப்புகள்|முக்கிய\s*கண்டுபிடிப்பு|கண்டறிதல்கள்)\s*:?\s*)/i,
    },
    {
      sec: SECTIONS[3], // Conclusion
      regex: /(?:^|\n)\s*(?:(?:4\.?\s*)?(?:Conclusion|முடிவு|முடிவுரை)\s*:?\s*)/i,
    },
  ];

  // Find all matching positions
  const matches = [];
  for (const { sec, regex } of patterns) {
    const match = cleanText.match(regex);
    if (match) {
      matches.push({
        ...sec,
        index: match.index,
        length: match[0].length,
      });
    }
  }

  if (matches.length === 0) {
    // Fallback: try splitting on bare numbered markers (1., 2., 3., 4.)
    const numRegex = /(?:^|\n)\s*([1-4])\.\s*/g;
    let m;
    while ((m = numRegex.exec(cleanText)) !== null) {
      const secIdx = parseInt(m[1]) - 1;
      if (SECTIONS[secIdx]) {
        matches.push({
          ...SECTIONS[secIdx],
          index: m.index,
          length: m[0].length,
        });
      }
    }
  }

  if (matches.length === 0) return [];

  // Sort by position in text
  matches.sort((a, b) => a.index - b.index);

  const results = [];
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i];
    const next = matches[i + 1];

    const startIdx = curr.index + curr.length;
    const endIdx = next ? next.index : cleanText.length;

    let content = cleanText.slice(startIdx, endIdx).trim();
    content = content.replace(/^[:\-\s\n]+/, "").replace(/[:\-\s\n]+$/, "").trim();

    if (content) {
      results.push({
        key: curr.key,
        label: curr.label,
        tamilLabel: curr.tamilLabel,
        className: curr.className,
        icon: curr.icon,
        content,
      });
    }
  }

  return results;
}

/* ── Main Component ───────────────────────────────────── */
const SummaryCard = ({ data }) => {
  const [lang, setLang] = useState("en");        // "en" | "ta"
  const [length, setLength] = useState("detailed"); // "detailed" | "concise"
  const [tamilText, setTamilText] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);

  const [isReading, setIsReading] = useState(false);
  const [tamilAudioSrc, setTamilAudioSrc] = useState(null);
  const [tamilAudioLoading, setTamilAudioLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceHint, setVoiceHint] = useState(false);

  const audioRef = useRef(null);
  const recognitionRef = useRef(null);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  if (!data) return null;

  const rawSummary = data.summary || "";
  const shortSummary = data.short_summary || rawSummary;
  const activeSummary = length === "detailed" ? rawSummary : shortSummary;
  
  const parsedSections = parseSections(activeSummary);
  const hasParsed = parsedSections.length > 0;

  // Parse Tamil text into sections (pattern-based, language-agnostic)
  const tamilParsedSections = tamilText ? parseSectionsByPattern(tamilText) : [];
  const hasTamilParsed = tamilParsedSections.length > 0;

  /* ── Read Aloud (English) ─────────────────────────── */
  const stopReading = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsReading(false);
  }, []);

  const readEnglish = useCallback(() => {
    if (isReading) { stopReading(); return; }
    const text = activeSummary;
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.onend = () => setIsReading(false);
    utterance.onerror = () => setIsReading(false);
    setIsReading(true);
    window.speechSynthesis.speak(utterance);
  }, [isReading, activeSummary, stopReading]);

  /* ── Read Aloud (Tamil via gTTS) ──────────────────── */
  const readTamil = useCallback(async () => {
    if (!tamilText) return;

    if (isReading && audioRef.current && !audioRef.current.paused) {
      stopReading();
      return;
    }

    if (tamilAudioSrc) {
      audioRef.current.play();
      setIsReading(true);
      return;
    }

    setTamilAudioLoading(true);
    try {
      const res = await axios.post("http://127.0.0.1:5000/tts", {
        text: tamilText,
        lang: "ta",
      });
      const src = `data:audio/mp3;base64,${res.data.audio}`;
      setTamilAudioSrc(src);
      // Give React a tick to set the src attribute
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = src;
          audioRef.current.play();
          setIsReading(true);
        }
      }, 80);
    } catch (err) {
      console.error("Tamil TTS failed:", err);
      setVoiceStatus("Tamil audio unavailable.");
      setTimeout(() => setVoiceStatus(""), 3000);
    } finally {
      setTamilAudioLoading(false);
    }
  }, [tamilText, isReading, tamilAudioSrc, stopReading]);

  /* ── Translate to Tamil ───────────────────────────── */
  const handleTranslate = useCallback(async (textToTranslate = activeSummary) => {
    setTranslating(true);
    setTranslateError(null);
    setLang("ta");
    try {
      const res = await axios.post("http://127.0.0.1:5000/translate", {
        text: textToTranslate,
        target: "ta",
      });
      setTamilText(res.data.translated);
      setTamilAudioSrc(null); // Reset audio for new text
    } catch (err) {
      setTranslateError(err.response?.data?.error || "Translation failed. Please retry.");
    } finally {
      setTranslating(false);
    }
  }, [activeSummary]);

  // Translate on length change if currently in Tamil
  useEffect(() => {
    if (lang === "ta") {
      handleTranslate(activeSummary);
    }
  }, [length]);

  /* ── Copy to Clipboard ────────────────────────────── */
  const handleCopy = useCallback(() => {
    const text = lang === "ta" && tamilText ? tamilText : activeSummary;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }, [lang, tamilText, rawSummary]);

  /* ── Voice Commands ───────────────────────────────── */
  const handleVoiceCommand = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceStatus("");
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceStatus("Voice recognition is not supported in this browser.");
      setTimeout(() => setVoiceStatus(""), 4000);
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;

    rec.onstart = () => { setIsListening(true); setVoiceStatus("Listening for a command…"); };

    rec.onresult = (e) => {
      const cmd = e.results[0][0].transcript.toLowerCase().trim();
      setVoiceStatus(`Heard: "${cmd}"`);
      setTimeout(() => setVoiceStatus(""), 3500);

      if (/\bread\b/.test(cmd) || /\bplay\b/.test(cmd)) {
        lang === "ta" && tamilText ? readTamil() : readEnglish();
      } else if (/\bstop\b/.test(cmd) || /\bpause\b/.test(cmd)) {
        stopReading();
      } else if (/\btamil\b/.test(cmd) || /\btranslate\b/.test(cmd)) {
        handleTranslate();
      } else if (/\benglish\b/.test(cmd)) {
        setLang("en");
      } else if (/\bcopy\b/.test(cmd)) {
        handleCopy();
      } else {
        setVoiceStatus(`Unknown command: "${cmd}"`);
        setTimeout(() => setVoiceStatus(""), 3000);
      }
    };

    rec.onerror = (e) => {
      setVoiceStatus(`Error: ${e.error}`);
      setIsListening(false);
      setTimeout(() => setVoiceStatus(""), 3000);
    };

    rec.onend = () => setIsListening(false);
    rec.start();
  }, [isListening, lang, tamilText, readEnglish, readTamil, stopReading, handleTranslate, handleCopy]);

  /* ── Read button label ────────────────────────────── */
  const readLabel = (() => {
    if (lang === "ta") {
      if (tamilAudioLoading) return { icon: "⏳", text: "Loading Audio…" };
      return isReading ? { icon: "⏹", text: "Stop Reading" } : { icon: "🔊", text: "Read Tamil Aloud" };
    }
    return isReading ? { icon: "⏹", text: "Stop Reading" } : { icon: "🔊", text: "Read Aloud" };
  })();

  const onReadClick = () => lang === "ta" ? readTamil() : readEnglish();

  return (
    <div className="summary-dashboard">
      {/* Hidden audio element for Tamil playback */}
      <audio
        ref={audioRef}
        src={tamilAudioSrc || undefined}
        onEnded={() => setIsReading(false)}
      />

      {/* ── Header ── */}
      <div className="dashboard-header">
        <div className="paper-info">
          <svg className="pdf-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="paper-metadata">
            <span className="metadata-label">Research Paper</span>
            <h2 className="paper-title">{data.filename}</h2>
          </div>
        </div>

        {/* Tabs: Length & Language */}
        <div className="dashboard-tabs-container" style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div className="dashboard-tabs">
            <button
              className={`tab-button ${length === "detailed" ? "active" : ""}`}
              onClick={() => { setLength("detailed"); stopReading(); }}
            >
              📄 Detailed
            </button>
            <button
              className={`tab-button ${length === "concise" ? "active" : ""}`}
              onClick={() => { setLength("concise"); stopReading(); }}
            >
              ⚡ Concise
            </button>
          </div>

          <div className="dashboard-tabs">
            <button
              id="tab-english"
              className={`tab-button ${lang === "en" ? "active" : ""}`}
              onClick={() => { setLang("en"); stopReading(); }}
            >
              🇬🇧 English
            </button>
            <button
              id="tab-tamil"
              className={`tab-button ${lang === "ta" ? "active" : ""}`}
              onClick={() => { if (!tamilText) handleTranslate(); else setLang("ta"); }}
            >
              {translating ? (
                <span className="tab-spinner" />
              ) : "🇮🇳"} தமிழ் (Tamil)
            </button>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="card-toolbar">
          <button
            id="btn-read-aloud"
            className={`toolbar-btn read-btn ${isReading ? "active-read" : ""}`}
            onClick={onReadClick}
            disabled={tamilAudioLoading || (lang === "ta" && !tamilText && !translating)}
            title={lang === "ta" ? "Read Tamil summary aloud" : "Read English summary aloud"}
          >
            <span className="toolbar-btn-icon">{readLabel.icon}</span>
            <span>{readLabel.text}</span>
          </button>

          <button
            id="btn-copy"
            className={`toolbar-btn copy-btn ${copied ? "copied" : ""}`}
            onClick={handleCopy}
            title="Copy summary to clipboard"
          >
            <span className="toolbar-btn-icon">{copied ? "✓" : "📋"}</span>
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          <button
            id="btn-voice-command"
            className={`toolbar-btn voice-btn ${isListening ? "listening" : ""}`}
            onClick={handleVoiceCommand}
            title="Voice commands: read, stop, translate, english, copy"
            onMouseEnter={() => setVoiceHint(true)}
            onMouseLeave={() => setVoiceHint(false)}
          >
            <span className="toolbar-btn-icon mic-icon">{isListening ? "🔴" : "🎤"}</span>
            <span>{isListening ? "Listening…" : "Voice Command"}</span>
            {isListening && <span className="mic-pulse-ring" />}
          </button>
        </div>

        {/* Voice hint tooltip */}
        {voiceHint && !isListening && (
          <div className="voice-hint-box">
            <p className="voice-hint-title">Voice Commands</p>
            <ul className="voice-hint-list">
              <li><kbd>read</kbd> — Read summary aloud</li>
              <li><kbd>stop</kbd> — Stop reading</li>
              <li><kbd>translate</kbd> — Translate to Tamil</li>
              <li><kbd>english</kbd> — Switch to English</li>
              <li><kbd>copy</kbd> — Copy text</li>
            </ul>
          </div>
        )}

        {/* Voice status */}
        {voiceStatus && (
          <p className="voice-status-bar">{voiceStatus}</p>
        )}
      </div>

      {/* ── Body ── */}
      <div className="dashboard-content">

        {/* ── English Content ── */}
        {lang === "en" && (
          hasParsed ? (
            parsedSections.map((sec) => (
              <div key={sec.key} className={`summary-section ${sec.className}`}>
                <div className="section-header">
                  <div className="section-icon-container">{sec.icon}</div>
                  <h3>{sec.label}</h3>
                </div>
                <p className="section-body">{sec.content}</p>
              </div>
            ))
          ) : (
            <div className="raw-summary">
              {rawSummary.split("\n").map((line, i) => {
                if (/^(1\.|2\.|3\.|4\.)\s*(Objective|Methodology|Key Findings?|Conclusion)/i.test(line)) {
                  return <p key={i} className="raw-section-title">{line}</p>;
                }
                if (line.trim() === "") return <div key={i} className="raw-spacer" />;
                return <p key={i} className="raw-paragraph">{line}</p>;
              })}
            </div>
          )
        )}

        {/* ── Tamil Content ── */}
        {lang === "ta" && (
          <div className="tamil-panel">
            {translating && (
              <div className="tamil-loading">
                <div className="tamil-spinner" />
                <p>Translating to Tamil…</p>
              </div>
            )}

            {!translating && translateError && (
              <div className="tamil-error">
                <span>⚠️</span>
                <p>{translateError}</p>
                <button
                  className="toolbar-btn"
                  onClick={() => { setTranslateError(null); setTamilText(null); handleTranslate(); }}
                >
                  Retry
                </button>
              </div>
            )}

            {!translating && tamilText && (
              hasTamilParsed ? (
                <>
                  <div className="tamil-badge">
                    <span>🌐</span> தமிழ் மொழிபெயர்ப்பு · Tamil Translation
                  </div>
                  {tamilParsedSections.map((sec) => (
                    <div key={sec.key} className={`summary-section ${sec.className}`}>
                      <div className="section-header">
                        <div className="section-icon-container">{sec.icon}</div>
                        <h3>{sec.tamilLabel || sec.label}</h3>
                      </div>
                      <p className="section-body tamil-text">{sec.content}</p>
                    </div>
                  ))}
                </>
              ) : (
                <div className="tamil-content">
                  <div className="tamil-badge">
                    <span>🌐</span> Tamil Translation
                  </div>
                  <p className="tamil-text">{tamilText}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryCard;