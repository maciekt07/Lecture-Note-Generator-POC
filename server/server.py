from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import time
import torch
import whisper
import ollama
import os
import logging
import shutil
from database import Database
from static_server import setup_static_routes

WHISPER_SIZE = "medium"
OLLAMA_MODEL = "llama3.1:8b"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = Database()
setup_static_routes(app)

device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {device}")

model = whisper.load_model(WHISPER_SIZE, device=device)
logger.info("Whisper model loaded")

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    temp_audio_dir = os.path.join(base_dir, "audio")
    os.makedirs(temp_audio_dir, exist_ok=True)
    audio_file_path = os.path.join(temp_audio_dir, "uploaded_audio.mp3")

    total_bytes = bytearray()

    try:
        # receive all audio data
        while True:
            try:
                data = await websocket.receive_bytes()
                if len(data) == 0:
                    break
                total_bytes.extend(data)
                if len(total_bytes) % (1024 * 1024) == 0:
                    logger.info(f"Received {len(total_bytes) // (1024 * 1024)} MB")
                await websocket.send_text(f"Progress: Received {len(total_bytes) // (1024 * 1024)} MB")
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

    # save file
    try:
        with open(audio_file_path, "wb") as f:
            f.write(total_bytes)
        logger.info(f"Saved file: {len(total_bytes) / (1024 * 1024):.2f} MB")
    except Exception as e:
        await websocket.send_text(f"Error saving audio: {e}")
        await websocket.close()
        return

    await websocket.send_text("File received. Starting transcription...")

    try:
        start_time = time.time()
        result = model.transcribe(
            audio_file_path,
            verbose=True,
            word_timestamps=True,
            condition_on_previous_text=True,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4
        )

        transcription = result["text"]
        language = result["language"]
        duration = time.time() - start_time

        await websocket.send_text(f"Transcription completed in {duration:.2f} seconds.")
        await websocket.send_text(f"Detected language: {language}")
        await websocket.send_text(transcription)

        # generate title
        await websocket.send_text("Generating title...")
        title_prompt = f"""Generate a short, descriptive title (max 5-7 words) for this academic content:

{transcription}

Requirements:
- Keep it concise but descriptive
- Focus on the main topic
- Do not use quotes or special characters
- Return only the title, nothing else
"""
        title = ""
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=title_prompt, stream=True):
            title += chunk["response"]
        title = title.strip()
        await websocket.send_text("title:" + title)

        # generate structured notes
        await websocket.send_text("Generating structured notes...")
        notes_prompt = f"""
Create a well-structured academic note in {language} based on the following transcription:

{transcription}

Requirements:
- Use markdown formatting
- Clear headings, subheadings, bullet points
- Use $...$ for inline math, $$...$$ for block math
- Do not include extra content, only the note
- Do not include separators, links, or quotes
"""
        # generate short description first
        description_prompt = f"""Generate a 1-2 sentence summary of this content:
{transcription}

Requirements:
- Keep it very concise (max 2 sentences)
- Focus on the main topic and key points
- Make it engaging but academic
- Return only the summary, nothing else"""

        description = ""
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=description_prompt, stream=True):
            description += chunk["response"]
        description = description.strip()

        note_content = f"# {title}\n\n_{description}_\n\n"  # Add title and description at the top
        
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=notes_prompt, stream=True):
            response = chunk["response"]
            note_content += response
            if "\n" in note_content:
                lines = note_content.split("\n")
                for line in lines[:-1]:
                    if line.strip():
                        await websocket.send_text(line + "\n")
                note_content = lines[-1]
        if note_content.strip():
            await websocket.send_text(note_content)

        # save note to DB
        note_id = db.add_note(title=title, content=note_content, language=language)

        # save audio
        media_dir = f"media/audio/{note_id}"
        os.makedirs(media_dir, exist_ok=True)
        shutil.copy2(audio_file_path, os.path.join(media_dir, "audio.mp3"))

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

@app.get("/api/notes")
async def get_notes():
    return db.get_all_notes()

@app.get("/api/notes/{note_id}")
async def get_note(note_id: int):
    note = db.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note
