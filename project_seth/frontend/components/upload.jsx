import { useState, useRef } from "react";
import axios from "axios";

const Upload = ({ setSummary, setLoading, setError, setStatusText }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError && setError("Only PDF files are supported.");
      return;
    }

    setSelectedFile(file);
    setLoading && setLoading(true);
    setError && setError(null);
    setSummary(null);

    const statusMessages = [
      "Extracting text from PDF...",
      "Analyzing document structure...",
      "Running language model...",
      "Synthesizing summary...",
    ];
    let msgIndex = 0;
    setStatusText && setStatusText(statusMessages[0]);
    const interval = setInterval(() => {
      msgIndex = (msgIndex + 1) % statusMessages.length;
      setStatusText && setStatusText(statusMessages[msgIndex]);
    }, 4000);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("http://127.0.0.1:5000/summarize", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSummary(res.data);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Failed to upload file. Make sure the backend server is running.";
      setError && setError(msg);
    } finally {
      clearInterval(interval);
      setLoading && setLoading(false);
      setStatusText && setStatusText("");
    }
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) handleUpload(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div
      className={`upload-zone ${dragActive ? "drag-active" : ""}`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="file-input-hidden"
        onChange={handleChange}
      />

      <div className="upload-zone-content">
        <div className="upload-icon-container">
          <svg className="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <h3>Drop your PDF here</h3>
        <p className="upload-hint">or click to browse files</p>

        <button type="button" className="upload-button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
          Choose PDF File
        </button>

        {selectedFile && (
          <div className="selected-file-info">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="file-name">{selectedFile.name}</span>
            <span className="file-size">{formatSize(selectedFile.size)}</span>
          </div>
        )}
      </div>

      {dragActive && (
        <div className="drag-overlay">
          <p className="drag-overlay-message">Release to analyze</p>
        </div>
      )}
    </div>
  );
};

export default Upload;
