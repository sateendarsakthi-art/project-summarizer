import { useState } from "react";
import "./SummaryCard.css";

const SummaryCard = ({ data }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [activeSection, setActiveSection] = useState("full");

  if (!data) return null;

  const handlePlayAudio = async () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
      return;
    }

    setIsPlaying(true);
    try {
      const response = await fetch("http://127.0.0.1:5000/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: data.summary }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.play();
    } catch (error) {
      console.error("Error playing audio:", error);
      alert("Failed to generate audio. Please try again.");
    } finally {
      setIsPlaying(false);
    }
  };

  const parseSections = () => {
    const text = data.summary;
    const sections = {
      full: text,
      objective: extractSection(text, "Objective"),
      methodology: extractSection(text, "Methodology"),
      findings: extractSection(text, "Key Findings"),
      conclusion: extractSection(text, "Conclusion"),
    };
    return sections;
  };

  const extractSection = (text, sectionName) => {
    const pattern = new RegExp(
      `\\d+\\.\\s*${sectionName}\\s*[\\r\\n]+([^\\d]*?)(?=\\d+\\.|$)`,
      "i"
    );
    const match = text.match(pattern);
    return match ? match[1].trim() : "";
  };

  const sections = parseSections();
  const sectionKeys = {
    full: { label: "Full Dashboard", icon: "📋" },
    objective: { label: "Objective", icon: "🎯" },
    methodology: { label: "Methodology", icon: "🔬" },
    findings: { label: "Key Findings", icon: "💡" },
    conclusion: { label: "Conclusion", icon: "✅" },
  };

  return (
    <div className="summary-card">
      <div className="summary-header">
        <div className="summary-title">
          <span className="title-icon">📄</span>
          <h2>{data.filename}</h2>
        </div>
        <button
          className="tts-button"
          onClick={handlePlayAudio}
          disabled={isPlaying}
        >
          {isPlaying ? "🔊 Generating..." : "🔊 Play"}
        </button>
      </div>

      <div className="section-tabs">
        {Object.entries(sectionKeys).map(([key, { label, icon }]) => (
          <button
            key={key}
            className={`section-tab ${activeSection === key ? "active" : ""}`}
            onClick={() => setActiveSection(key)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="section-content">
        <div className="content-box">
          {activeSection === "full" ? (
            <pre className="summary-text">{sections.full}</pre>
          ) : (
            <p className="section-text">{sections[activeSection] || "No content for this section"}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;
