from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import os
from app.api.routes import router as api_router
from app.core.config import APP_NAME, MEDIA_DIR
from app.services.transcription import TranscriptionService
from app.services.ollama import OllamaService
from app.db.database import Database
import time

# setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# init database
db = Database()

app = FastAPI(title=APP_NAME)

# add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(os.path.join(MEDIA_DIR, "audio"), exist_ok=True)

app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": f"Welcome to {APP_NAME} API"}

#TODO: move this to a separate file

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")

    # Set up temporary audio file path
    temp_dir = os.path.join(MEDIA_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    audio_file_path = os.path.join(temp_dir, f"upload_{int(time.time())}.mp3")

    total_bytes = bytearray()

    try:
        # Receive all audio data
        while True:
            try:
                data = await websocket.receive_bytes()
                if len(data) == 0:
                    break
                total_bytes.extend(data)
                if len(total_bytes) % (1024 * 1024) == 0:
                    logger.info(f"Received {len(total_bytes) // (1024 * 1024)} MB")
            except Exception as e:
                logger.error(f"WebSocket receive error: {e}")
                await websocket.send_text(f"Error: {e}")
                await websocket.close()
                return
    except Exception as e:
        logger.error(f"Receive loop error: {e}")
        await websocket.send_text(f"Receive error: {e}")
        await websocket.close()
        return

    # Save file
    try:
        await TranscriptionService.save_audio_data(total_bytes, audio_file_path)
        await websocket.send_text("File received. Starting transcription...")
    except Exception as e:
        await websocket.send_text(f"Error saving audio: {e}")
        await websocket.close()
        return

    try:
        # Transcribe audio
        result = TranscriptionService.transcribe_audio(audio_file_path)
        transcription = result["text"]
        language = result["language"]
        duration = result["duration"]

        await websocket.send_text(f"Transcription completed in {duration:.2f} seconds.")
        await websocket.send_text(f"Detected language: {language}")
        await websocket.send_text(transcription)

        # Generate title
        await websocket.send_text("Generating title...")
        title = OllamaService.generate_title(transcription, language)
        await websocket.send_text("title:" + title)

        # Generate summary
        description = OllamaService.generate_summary(transcription, language)

        # Generate and stream structured notes
        await websocket.send_text("Generating structured notes...")
        await websocket.send_text("# " + title + "\n\n")
        
        markdown_content = await OllamaService.stream_note_content(websocket, transcription, language)

        # Construct final note content
        note_content = f"# {title}\n\n{markdown_content}"

        # Save note to DB
        note_id = db.add_note(
            title=title,
            content=note_content,
            summary=description,
            language=language
        )

        # Save audio
        TranscriptionService.save_audio_for_note(audio_file_path, note_id)

        await websocket.send_text(f"note_id:{note_id}")
        await websocket.send_text("Note generation completed.")

    except Exception as e:
        logger.error(f"Processing error: {e}")
        await websocket.send_text(f"Processing error: {e}")

    finally:
        try:
            os.remove(audio_file_path)
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
        await websocket.close()
