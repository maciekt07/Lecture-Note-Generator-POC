import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MEDIA_DIR = os.path.join(BASE_DIR, "media")

APP_NAME = "Lecture Note Generator"
DEBUG = True

DB_FILE = os.path.join(BASE_DIR, "notes.db")

WHISPER_SIZE = "medium"
OLLAMA_MODEL = "llama3.1:8b"


os.makedirs(os.path.join(MEDIA_DIR, "audio"), exist_ok=True)
