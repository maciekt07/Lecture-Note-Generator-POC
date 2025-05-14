
from fastapi import APIRouter, HTTPException
import os
from app.db.database import Database
from app.core.config import MEDIA_DIR
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter()
db = Database()

@router.get("/notes")
async def get_notes():
    return db.get_all_notes()

@router.get("/notes/{note_id}")
async def get_note(note_id: int):
    note = db.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.get("/audio/{note_id}")
async def get_audio(note_id: int):
    """Get the audio file for a note."""
    file_path = f"{MEDIA_DIR}/audio/{note_id}/audio.mp3"
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="audio/mpeg",
            headers={"Accept-Ranges": "bytes"}
        )
    return JSONResponse(
        status_code=404,
        content={"error": "Audio file not found"}
    )
