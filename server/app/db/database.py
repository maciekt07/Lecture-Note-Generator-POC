import sqlite3
from typing import List, Dict
from app.core.config import DB_FILE

class Database:
    def __init__(self, db_file=DB_FILE):
        self.db_file = db_file
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_file) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    language TEXT NOT NULL,
                    audio_path TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

    def add_note(self, title: str, content: str, summary: str, language: str, audio_path: str = None) -> int:
        with sqlite3.connect(self.db_file) as conn:
            cursor = conn.execute(
                "INSERT INTO notes (title, content, summary, language, audio_path) VALUES (?, ?, ?, ?, ?)",
                (title, content, summary, language, audio_path)
            )
            return cursor.lastrowid

    def get_all_notes(self) -> List[Dict]:
        with sqlite3.connect(self.db_file) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT id, title, content, summary, language, created_at FROM notes ORDER BY created_at DESC"
            )
            return [dict(row) for row in cursor.fetchall()]

    def get_note(self, note_id: int) -> Dict:
        with sqlite3.connect(self.db_file) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT id, title, content, summary, language, created_at FROM notes WHERE id = ?",
                (note_id,)
            )
            result = cursor.fetchone()
            return dict(result) if result else None
