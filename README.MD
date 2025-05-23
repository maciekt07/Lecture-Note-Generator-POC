# AI Lecture Note Generator POC

<p align="center">
<img src="https://go-skill-icons.vercel.app/api/icons?i=py,fastapi,sqlite,ollama,chatgpt,react,typescript,vite,zustand,tailwindcss" />
</p>

A web application that converts lecture audio recordings into structured academic notes. Uses Whisper for transcription and Llama 3.1-8B for note generation.

![App Preview](preview.png)

## Stack

- Frontend: React + TypeScript + Tailwind CSS
- Backend: Python + FastAPI + Whisper + Ollama

## Features

- Note history stored in a local SQLite database
- Real-time updates via WebSocket
- Math rendering with KaTeX

## Setup

### Requirements

- Python 3.8+
- Node.js
- Ollama

### Backend

```bash
cd server
pip install -r requirements.txt
python run.py
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Credits

Made with ❤️ by [maciekt07](https://github.com/maciekt07), licensed under [MIT](https://github.com/maciekt07/Lecture-Note-Generator-POC/blob/main/LICENSE).
