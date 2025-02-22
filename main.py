import time
import torch
import whisper
import ollama

start_time = time.time()


device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")


print("Loading Whisper model...")
model = whisper.load_model("medium", device=device)


print("Transcribing audio file...")
transcription_start = time.time()
result = model.transcribe("audio/audio2.mp3", verbose=True) 
transcription_time = time.time() - transcription_start
transcription = result["text"]
language = result["language"]
print(f"✅ Transcription completed in {transcription_time:.2f} seconds.")


summary_start = time.time()
prompt = f"""
Create a well-structured academic note in {language} based on the following transcription:

{transcription}

**Requirements:**  
- Use proper markdown syntax and output only the formatted note.  
- Ensure the note is **comprehensive**, covering all topics in the transcription.  
- Organize content with **clear headings, subheadings, and bullet points**.  
- Use `$...$` for inline math and `$$...$$` for block math expressions.  
- Format key terms, definitions, and equations appropriately.  
- Summarize complex concepts concisely while maintaining accuracy.  

Do not include any additional text outside the markdown-formatted note.
"""

print("Summarizing transcription...")
summary = ""
for chunk in ollama.generate(model="llama3.1:8b", prompt=prompt, stream=True):
    print(chunk["response"], end="", flush=True) 
    summary += chunk["response"]

summary_time = time.time() - summary_start
print(f"\n✅ Summarization completed in {summary_time:.2f} seconds.")


with open("output.md", "w", encoding="utf-8") as f:
    f.write(summary)


end_time = time.time()
total_elapsed_time = end_time - start_time
transcription_minutes, transcription_seconds = divmod(int(transcription_time), 60)
summary_minutes, summary_seconds = divmod(int(summary_time), 60)
total_minutes, total_seconds = divmod(int(total_elapsed_time), 60)

print(f"""
⏳ Process completed:
- 📝 Transcription: {transcription_minutes:02}:{transcription_seconds:02}
- ✍️  Summarization: {summary_minutes:02}:{summary_seconds:02}
- ⏲️  Total time: {total_minutes:02}:{total_seconds:02}
""")
