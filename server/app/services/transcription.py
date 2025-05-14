import time
import os
import logging
import shutil
import whisper
from app.core.config import WHISPER_SIZE, MEDIA_DIR

logger = logging.getLogger(__name__)

# init whisper model
model = whisper.load_model(WHISPER_SIZE)
logger.info("Whisper model loaded")

class TranscriptionService:
    @staticmethod
    async def save_audio_data(data: bytes, file_path: str):
        """Save audio data to a file"""
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as f:
            f.write(data)
        logger.info(f"Saved file: {len(data) / (1024 * 1024):.2f} MB")
        
    @staticmethod
    def transcribe_audio(audio_file_path: str):
        """Transcribe audio file using Whisper"""
        start_time = time.time()
        result = model.transcribe(
            audio_file_path,
            verbose=True,
            word_timestamps=True,
            condition_on_previous_text=True,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4
        )
        
        duration = time.time() - start_time
        logger.info(f"Transcription completed in {duration:.2f} seconds")
        
        return {
            "text": result["text"],
            "language": result["language"],
            "duration": duration
        }
    
    @staticmethod
    def save_audio_for_note(temp_audio_path: str, note_id: int):
        """Save audio file for a specific note"""
        media_dir = os.path.join(MEDIA_DIR, f"audio/{note_id}")
        os.makedirs(media_dir, exist_ok=True)
        target_path = os.path.join(media_dir, "audio.mp3")
        shutil.copy2(temp_audio_path, target_path)
        return target_path
