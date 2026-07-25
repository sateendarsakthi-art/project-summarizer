import { useState, useRef, useCallback, useEffect } from "react";
import axios from "axios";
import Upload from "./upload";
import SummaryCard from "./summarycard";
import History from "./History";
import "./App.css";

/* ── Floating voice widget for the upload screen ─── */
function UploadVoiceWidget({ onTriggerUpload }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [hint, setHint] = useState(false);
  const recRef = useRef(null);

  const toggle = useCallback(() => {
    if (isListening) {
      recRef.current?.stop();
      setIsListening(false);
      setTranscript("");
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setTranscript("Voice recognition not supported in this browser.");
      return;
    }

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onstart = () => { setIsListening(true); setTranscript("Listening…"); };

    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setTranscript(text);

      // Final result → check for upload command
      if (e.results[e.results.length - 1].isFinal) {
        const cmd = text.toLowerCase();
        if (/\bupload\b/.test(cmd) || /\bopen\b/.test(cmd) || /\bselect\b/.test(cmd)) {
          onTriggerUpload?.();
        }
        setTimeout(() => setTranscript(""), 3500);
      }
    };

    rec.onerror = (e) => {
      setTranscript(`Error: ${e.error}`);
      setIsListening(false);
      setTimeout(() => setTranscript(""), 3000);
    };

    rec.onend = () => setIsListening(false);
    rec.start();
  }, [isListening, onTriggerUpload]);

  return (
    <div className="voice-widget-wrap">
      <div
        className={`voice-widget ${isListening ? "voice-widget--listening" : ""}`}
        onMouseEnter={() => setHint(true)}
        onMouseLeave={() => setHint(false)}
      >
        <button
          id="floating-voice-btn"
          className="voice-fab"
          onClick={toggle}
          title="Voice command: say 'upload' to open file picker"
          aria-label="Voice control"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="fab-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          {isListening && <span className="fab-pulse" />}
          {isListening && <span className="fab-pulse fab-pulse--delay" />}
        </button>

        {hint && !isListening && (
          <div className="voice-fab-tooltip">
            <p className="voice-hint-title">Voice Control</p>
            <ul className="voice-hint-list">
              <li><kbd>upload</kbd> — Open file picker</li>
              <li><kbd>select</kbd> — Open file picker</li>
            </ul>
          </div>
        )}
      </div>

      {transcript && (
        <div className={`voice-transcript ${isListening ? "voice-transcript--live" : ""}`}>
          <span className="transcript-dot" />
          {transcript}
        </div>
      )}
    </div>
  );
}

/* ── Main App ──────────────────────────────────────── */
function App() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusText, setStatusText] = useState("");

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);

  // Ref to trigger Upload's hidden file input
  const uploadTriggerRef = useRef(null);
  const triggerUpload = useCallback(() => {
    uploadTriggerRef.current?.();
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get("http://127.0.0.1:5000/history");
      setHistoryItems(res.data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory, fetchHistory]);

  const deleteHistory = async (id) => {
    try {
      await axios.delete(`http://127.0.0.1:5000/history/${id}`);
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete history item:", err);
    }
  };

  const handleHistoryItemClick = (item) => {
    setSummary(item);
    setShowHistory(false);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-brand">
          <div className="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1>Seth Summarizer</h1>
        </div>

        <button
          className="history-toggle-btn"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? "← Back to Dashboard" : "⏱️ View History"}
        </button>

        <p className="app-tagline">
          Automated academic document analysis · Voice-enabled · Tamil Translation
        </p>
      </header>

      <main className="app-content">
        {showHistory ? (
          <History
            items={historyItems}
            onItemClick={handleHistoryItemClick}
            onDelete={deleteHistory}
            onRefresh={fetchHistory}
          />
        ) : (
          <>
            {!summary && !loading && (
              <section className="section-upload">
                <div className="intro-card">
                  <h2>Accelerate Your Academic Research</h2>
                  <p>
                    Upload any academic paper or research document in PDF format. Our localized Large
                    Language Model will automatically extract, analyze, and synthesize the paper's core
                    components — with voice readback and Tamil translation support.
                  </p>

                  {/* Feature pills */}
                  <div className="feature-pills">
                    <span className="feature-pill pill-voice">🎤 Voice Commands</span>
                    <span className="feature-pill pill-read">🔊 Read Aloud</span>
                    <span className="feature-pill pill-tamil">🌐 Tamil Translation</span>
                  </div>
                </div>

                <Upload
                  setSummary={setSummary}
                  setLoading={setLoading}
                  setError={setError}
                  setStatusText={setStatusText}
                  onRegisterTrigger={(fn) => { uploadTriggerRef.current = fn; }}
                />

                <UploadVoiceWidget onTriggerUpload={triggerUpload} />
              </section>
            )}

            {loading && (
              <section className="section-loading">
                <div className="loading-card">
                  <div className="pulse-spinner-container">
                    <div className="pulse-spinner"></div>
                    <div className="pulse-spinner-inner"></div>
                  </div>
                  <h3>Analyzing Document…</h3>
                  <p className="status-text">{statusText}</p>
                  <div className="loading-progress-bar-container">
                    <div className="loading-progress-bar"></div>
                  </div>
                  <span className="loading-subtext">
                    This process may take 30–45 seconds depending on document size.
                  </span>
                </div>
              </section>
            )}

            {error && (
              <section className="section-error">
                <div className="error-card">
                  <div className="error-icon-container">
                    <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3>Analysis Failed</h3>
                  <p>{error}</p>
                  <button
                    type="button"
                    className="retry-button"
                    onClick={() => { setError(null); setSummary(null); setLoading(false); }}
                  >
                    Try Again
                  </button>
                </div>
              </section>
            )}

            {summary && !loading && (
              <section className="section-results">
                <SummaryCard data={summary} />
                <div className="results-actions">
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => { setSummary(null); setError(null); }}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="button-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.27 15H18" />
                    </svg>
                    Summarize Another Paper
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Powered by Qwen 2.5 · Voice-enabled · Tamil Translation via Google Translate</p>
      </footer>
    </div>
  );
}

export default App;
