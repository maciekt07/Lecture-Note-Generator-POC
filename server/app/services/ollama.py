import ollama
import logging
from fastapi import WebSocket
from app.core.config import OLLAMA_MODEL

logger = logging.getLogger(__name__)

class OllamaService:
    @staticmethod
    def generate_title(transcription: str, language: str) -> str:
        """Generate a title based on transcription"""
        title_prompt = f"""Generate a short, descriptive title (max 5-7 words) for this academic content:

        {transcription}

        Requirements:
        - Keep it concise but descriptive
        - Focus on the main topic
        - Do not use quotes or special characters
        - Only answer in language: {language}
        - Return only the title, nothing else"""
                              
        title = ""
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=title_prompt, stream=True):
            title += chunk["response"]
        return title.strip()
    
    @staticmethod
    def generate_summary(transcription: str, language: str) -> str:
        """Generate a short summary of the transcription"""
        summary_prompt = f"""Generate a 1-2 sentence summary of this content:

        {transcription}

        Requirements:
        - Keep it very concise (max 2 sentences)
        - Focus on the main topic and key points
        - Make it engaging but academic
        - Only answer in language: {language}
        - Return only the summary, nothing else"""

        summary = ""
        for chunk in ollama.generate(model=OLLAMA_MODEL, prompt=summary_prompt, stream=True):
            summary += chunk["response"]
        return summary.strip()
    
    @staticmethod
    async def stream_note_content(websocket: WebSocket, transcription: str, language: str) -> str:
        """Generate and stream structured notes based on transcription"""
        notes_prompt = f"""
You are an academic assistant. Your task is to generate a well-structured, high-quality academic note in **Markdown** format from the transcription below.

Transcription:
{transcription}

Instructions:
- Language: **{language}**
- Format the output as a complete Markdown document
- Begin with a title using `#` (e.g., `# Introduction to Quantum Mechanics`)
- Organize the content into logical sections and subsections using `##` and `###`
- Use bullet points (`-`) for lists where helpful
- Write in full, natural sentences and well-structured paragraphs
- Use inline math formatting with `$...$` and block math with `$$...$$`
- If any tables or data arrays are included (e.g., math values), use LaTeX array format inside `$$...$$`, not Markdown tables
- Separate all sections and paragraphs with clear newlines
- Do not include anything outside of the final Markdown document
- Make sure the content is accurate, coherent, and properly formatted

Return only the complete Markdown-formatted academic note.
"""
        markdown_content = ""
        current_paragraph = []
        
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
                
        return markdown_content.strip()
