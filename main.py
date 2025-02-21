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
# CRITICAL: Generate EXTENSIVE, ACCURATE Lecture Notes from Audio Transcription
Source language: {language}

## ESSENTIAL INFORMATION:
* This transcription represents an ACTUAL LECTURE with visual demonstrations
* The speaker likely points to drawings, graphs, or equations while speaking
* Many critical concepts appear VISUALLY but are only referenced verbally
* The notes MUST reconstruct these visual elements from context clues

## REQUIRED LENGTH AND COMPLETENESS:
* Generate at minimum 2000-3000 words of content (approximately 5-7 pages)
* The notes MUST be significantly MORE DETAILED than the original transcription
* EXPAND all abbreviated explanations and implied visual references
* ADD explanatory content that would make these notes comprehensive and standalone

## CONTENT ACCURACY REQUIREMENTS:
* PARSE the transcription to identify the EXACT content being taught
* DISTINGUISH between core academic content and casual speaking style
* IDENTIFY all technical terms, formulas, and concepts mentioned
* RECONSTRUCT any mathematical formulas in proper notation
* VERIFY internal consistency of all technical information

## STRUCTURE REQUIREMENTS:
* Start with a comprehensive Table of Contents
* Create properly nested sections (minimum 5 major sections with subsections)
* Include numbered examples (minimum 5-8 complete examples)
* Provide step-by-step explanations for each concept
* Add visual descriptions using text/ASCII when appropriate
* Include a glossary of all technical terms

## ACADEMIC LANGUAGE TRANSFORMATION:
* CONVERT all casual language to formal academic prose
* REMOVE all conversational fillers and informal expressions
* MAINTAIN all educational content while improving structure
* STANDARDIZE all technical terminology
* FORMAT mathematical content using Markdown conventions:
  - Inline math: $equation$ (e.g., $y = x^2$)
  - Display math: $$equation$$ (e.g., $$f(x) = ax^2 + bx + c$$)

## QUALITY ASSURANCE STEPS:
1. First, analyze the entire transcription to identify ALL key concepts
2. Map out the logical structure of the complete lesson
3. Identify all formulas, definitions, and examples mentioned
4. Reconstruct visual elements that were likely shown but only referenced
5. Fill gaps in explanation that would be unclear without visual context
6. Cross-check all technical information for accuracy and consistency
7. Verify completeness by ensuring ALL mentioned concepts are explained

Here is the transcription to transform:
```
{transcription}
```

IMPORTANT: Your response should ONLY contain the comprehensive educational notes in proper academic format. No disclaimers, explanations, or meta-commentary.
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
