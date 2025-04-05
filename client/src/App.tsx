import Transcription from "./Transcription";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h1 className="text-4xl font-bold text-gray-900 font-display">
              Lecture Note Generator
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto flex items-center justify-center gap-2">
            Transform your audio lectures into well-structured, academic notes
            using AI. Simply upload your recording and watch the magic happen.
          </p>
        </header>

        <main>
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <Transcription />
          </div>
        </main>

        <footer className="mt-12 text-center text-gray-500 text-sm">
          Powered by Whisper & Llama 3.1-8B • Made with ❤️ by{" "}
          <a href="https://github.com/maciekt07" target="_blank">
            maciekt07
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
