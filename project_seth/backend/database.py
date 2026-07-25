import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "summaries.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS summaries (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                filename    TEXT    NOT NULL,
                summary     TEXT    NOT NULL,
                short_summary TEXT,
                created_at  DATETIME DEFAULT (datetime('now','localtime'))
            )
        """)
        
        # Simple migration: add short_summary if it doesn't exist
        try:
            conn.execute("ALTER TABLE summaries ADD COLUMN short_summary TEXT")
        except sqlite3.OperationalError:
            # Column already exists
            pass
            
        conn.commit()


def save_summary(filename: str, summary: str, short_summary: str = None) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO summaries (filename, summary, short_summary) VALUES (?, ?, ?)",
            (filename, summary, short_summary),
        )
        conn.commit()
        return cur.lastrowid


def get_all_summaries():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, filename, summary, short_summary, created_at FROM summaries ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_summary_by_id(summary_id: int):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, filename, summary, short_summary, created_at FROM summaries WHERE id = ?",
            (summary_id,),
        ).fetchone()
        return dict(row) if row else None


def delete_summary(summary_id: int) -> bool:
    with get_connection() as conn:
        cur = conn.execute("DELETE FROM summaries WHERE id = ?", (summary_id,))
        conn.commit()
        return cur.rowcount > 0
