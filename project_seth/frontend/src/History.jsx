import { useState } from "react";
import "./History.css";

const History = ({ items, onItemClick, onDelete, onRefresh }) => {
  const truncateText = (text, maxLength = 120) => {
    if (!text) return "";
    return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>
          ⏱️ Summary History{" "}
          <span className="history-count">{items.length}</span>
        </h2>
        <button className="refresh-btn" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      <div className="history-list">
        {items.length === 0 ? (
          <div className="empty-state">
            <p>No summaries yet. Start by uploading a PDF on the Dashboard!</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="history-item"
              onClick={() => onItemClick(item)}
            >
              <div className="history-item-header">
                <div className="history-item-title">
                  <span className="file-icon">📄</span>
                  <h3 title={item.filename}>{item.filename}</h3>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this summary?")) {
                      onDelete(item.id);
                    }
                  }}
                  title="Delete summary"
                >
                  🗑️
                </button>
              </div>
              <p className="history-item-date">{formatDate(item.created_at)}</p>
              <p className="history-item-preview">
                {truncateText(item.summary)}
              </p>
              <button
                className="view-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onItemClick(item);
                }}
              >
                👁️ View Summary
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default History;
