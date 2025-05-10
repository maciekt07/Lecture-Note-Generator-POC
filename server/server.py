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
- Only answer in language: {language}
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
- Write the output as a complete, well-formatted markdown document
- Start with the main header using # for the title
- Use ## for section headers and ### for subsections
- Use bullet points where appropriate
- Use $...$ for inline math and $$...$$ for block math formulas
- For any mathematical tables (e.g., x/y values), use LaTeX array format inside $$...$$, not Markdown tables
- Make sure all sections are properly separated with newlines
- Format the text in complete sentences and paragraphs
- Write naturally without breaking up words or sentences
- Return the complete note as a single coherent document
- Only answer in language: {language}
"""
        # generate short description first
        description_prompt = f"""Generate a 1-2 sentence summary of this content:
{transcription}

Requirements:
- Keep it very concise (max 2 sentences)
- Focus on the main topic and key points
- Make it engaging but academic
- Only answer in language: {language}
- Return only the summary, nothing else"""

        description = ""
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=description_prompt, stream=True):
            description += chunk["response"]
        description = description.strip()

        # Generate and stream the content
        markdown_content = ""
        current_paragraph = []
        await websocket.send_text("# " + title + "\n\n")

        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=notes_prompt, stream=True):
            response = chunk["response"]
            markdown_content += response
            
            # Split into sentences and sections
            if "." in response or "\n" in response or len("".join(current_paragraph)) > 100:
                current_text = "".join(current_paragraph) + response
                sentences = current_text.split(".")
                
                # Process all complete sentences
                for sentence in sentences[:-1]:
                    if sentence.strip():
                        await websocket.send_text(sentence.strip() + ".\n")
                
                # Keep any incomplete sentence
                current_paragraph = [sentences[-1]]
                
                # Handle section breaks
                if "\n" in response:
                    sections = response.split("\n")
                    for section in sections:
                        if section.strip():
                            await websocket.send_text(section.strip() + "\n")
                    current_paragraph = []
            else:
                current_paragraph.append(response)
                
        # Send any remaining content
        if current_paragraph:
            final_text = "".join(current_paragraph).strip()
            if final_text:
                await websocket.send_text(final_text)

        # Construct final note content
        note_content = f"# {title}\n\n{markdown_content.strip()}"

        # save note to DB with separate summary
        note_id = db.add_note(
            title=title,
            content=note_content,
            summary=description,
            language=language
        )

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

async def generate_note_content(websocket: WebSocket, model: str, prompt: str) -> str:
    """Generate and stream note content with proper formatting."""
    content = []
    current_block = []
    
    await websocket.send_text("\n")  # Initial newline for proper formatting
    
    for chunk in ollama.generate(model=model, prompt=prompt, stream=True):
        text = chunk["response"]
        
        # Split on common markdown and sentence boundaries
        splits = []
        current = ""
        for char in text:
            current += char
            # Check for markdown block boundaries or sentence endings
            if (current.endswith("\n\n") or 
                current.endswith(". ") or 
                current.endswith("# ") or 
                current.endswith("## ")):
                splits.append(current)
                current = ""
        if current:
            splits.append(current)
        
        # Process each split
        for split in splits:
            if split.strip():
                # If it's a header or complete sentence, send immediately
                if (split.strip().startswith("#") or 
                    split.strip().endswith(".") or 
                    "\n\n" in split):
                    await websocket.send_text(split.strip())
                    content.append(split.strip())
                else:
                    # Otherwise, add to current block
                    current_block.append(split)
                    # If we have a reasonable amount of content, send it
                    if len("".join(current_block)) > 50:
                        block = "".join(current_block).strip()
                        if block:
                            await websocket.send_text(block)
                            content.append(block)
                        current_block = []
    
    # Send any remaining content
    if current_block:
        final_block = "".join(current_block).strip()
        if final_block:
            await websocket.send_text(final_block)
            content.append(final_block)
    
    return "\n".join(content)

@app.get("/api/notes")
async def get_notes():
    return db.get_all_notes()

@app.get("/api/notes/{note_id}")
async def get_note(note_id: int):
    note = db.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note
