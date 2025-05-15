import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useNotes } from "../NotesContext";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import AudioPlayer from "../components/AudioPlayer";
import {
  ArrowLeftIcon,
  SparklesIcon,
  StopIcon,
  SpeakerWaveIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import type { Note } from "../types/types";
import removeMd from "remove-markdown";

const NoteView = () => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { fetchNote } = useNotes();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    const loadNote = async () => {
      if (!noteId) return;
      setLoading(true);
      const loadedNote = await fetchNote(Number(noteId));
      if (loadedNote) {
        setNote(loadedNote);
      }
      setLoading(false);
    };
    loadNote();
  }, [noteId, fetchNote]);

  const handleReadAloud = () => {
    if (!note?.content) return;

    if (synthRef.current.speaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      removeMd(
        note.content
          .replace(/(\${1,2})(.*?)\1/g, "") // Remove $...$ and $$...$$ LaTeX
          .trim()
      )
    );
    utterance.lang = note.language || "en-US";

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
    setIsSpeaking(true);
  };

  const handleCopyToClipboard = async () => {
    if (!note?.content) return;
    try {
      await navigator.clipboard.writeText(note.content);
    } catch {
      alert("Failed to copy note to clipboard.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Note not found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/")}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="h-5 w-5 mr-2" />
        Back to Note Generation
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{note.title}</h1>
        <div className="text-sm text-gray-500 mb-4">
          Created on {new Date(note.created_at).toLocaleDateString()} <br />
          Language:{" "}
          {new Intl.DisplayNames([navigator.language || "en"], {
            type: "language",
          }).of(note.language)}
        </div>

        {note.summary && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-gray-700 italic">{note.summary}</p>
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-700 mb-2">Original Audio</h2>
        <AudioPlayer src={`http://localhost:8000/api/audio/${note.id}`} />

        <div className="flex justify-between items-center mt-6">
          <h3 className="text-xl font-bold text-gray-700 mt-6 flex items-center space-x-2">
            <SparklesIcon className="h-5 w-5 text-purple-500" />
            <span>Generated Notes</span>
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center bg-gray-100 hover:bg-gray-200 text-sm text-gray-800 px-3 py-1.5 rounded-lg shadow"
            >
              <ClipboardIcon className="h-4 w-4 mr-1" />
              Copy
            </button>
            <button
              onClick={handleReadAloud}
              className={`flex items-center text-sm px-3 py-1.5 rounded-lg shadow ${
                isSpeaking
                  ? "bg-red-100 hover:bg-red-200 text-red-800"
                  : "bg-indigo-100 hover:bg-indigo-200 text-indigo-800"
              }`}
            >
              {isSpeaking ? (
                <>
                  <StopIcon className="h-4 w-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <SpeakerWaveIcon className="h-4 w-4 mr-1" />
                  Read Aloud
                </>
              )}
            </button>
          </div>
        </div>

        <div className="prose prose-indigo max-w-none mt-6 p-4 rounded-lg bg-gradient-to-br from-indigo-100 via-white to-purple-100">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {note.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default NoteView;
