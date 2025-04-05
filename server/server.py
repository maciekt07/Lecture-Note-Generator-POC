from fastapi import FastAPI, WebSocket
import time
import torch
import whisper
import ollama
import os
import logging

#TODO: add transcription chunk streaming

WHISPER_SIZE = "medium"
OLLAMA_MODEL = "llama3.1:8b"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

device = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {device}")

logger.info("Loading Whisper model...")
model = whisper.load_model(WHISPER_SIZE, device=device)
logger.info("Whisper model loaded successfully")

@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    
    os.makedirs("audio", exist_ok=True)
    audio_file_path = "audio/uploaded_audio.mp3"
    
    with open(audio_file_path, "wb") as audio_file:
        while True:
            try:
                data = await websocket.receive_bytes()
                if len(data) == 0:
                    break
                audio_file.write(data)
            except Exception as e:
                logger.error(f"Error receiving file: {str(e)}")
                await websocket.close()
                return

    await websocket.send_text("File received. Starting transcription...")

    try:
        transcription_start = time.time()
        
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
        transcription_time = time.time() - transcription_start
        
        await websocket.send_text(f"Transcription completed in {transcription_time:.2f} seconds.")
        await websocket.send_text(f"Detected language: {language}")
        await websocket.send_text(transcription)

        # generate summary
        await websocket.send_text("Generating structured notes...")
        prompt = f"""
        Create a well-structured academic note in {language} based on the following transcription:

        {transcription}

        **Requirements:**  
        - Use proper markdown syntax and output only the formatted note. 
        - Do not add any separators like "---" or "===" between paragraphs.
        - Ensure the note is **comprehensive**, covering all topics in the transcription.  
        - Organize content with **clear headings, subheadings, and bullet points**.  
        - Use $...$ for inline math and $$...$$ for block math expressions.  
        - Format key terms, definitions, and equations appropriately.  
        - Summarize complex concepts concisely while maintaining accuracy.  
        - Ensure proper spacing between words and sentences.
        - Maintain proper mathematical notation without breaking equations.
        - Only answer in {language} language.

        Do not include any additional text outside the markdown-formatted note.
        """
        
        # stream the summary with better formatting
        current_line = ""
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=prompt, stream=True):
            response = chunk["response"]
            current_line += response
            
            if "\n" in current_line:
                lines = current_line.split("\n")
                for line in lines[:-1]:
                    if line.strip():
                        await websocket.send_text(line + "\n")
                current_line = lines[-1]
        
        # send any remaining text
        if current_line.strip():
            await websocket.send_text(current_line)

        await websocket.send_text("\nNote generation completed.")

    except Exception as e:
        logger.error(f"Error during processing: {str(e)}")
        await websocket.send_text(f"Error during processing: {str(e)}")
    
    finally:
        try:
            os.remove(audio_file_path)
        except Exception as e:
            logger.error(f"Error removing temporary file: {str(e)}")
        await websocket.close()
