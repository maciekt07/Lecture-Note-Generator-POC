from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import shutil
import os
from fastapi.responses import JSONResponse, FileResponse

def setup_static_routes(app):

    os.makedirs("media/audio", exist_ok=True)
    

    app.mount("/media", StaticFiles(directory="media"), name="media")

    @app.get("/api/audio/{note_id}")
    async def get_audio(note_id: int):
        """Get the audio file for a note."""
        file_path = f"media/audio/{note_id}/audio.mp3"
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
