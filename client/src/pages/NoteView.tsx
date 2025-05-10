import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useNotes } from "../NotesContext";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import AudioPlayer from "../components/AudioPlayer";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import type { Note } from "../types/types";

const NoteView = () => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { fetchNote } = useNotes();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

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

        <AudioPlayer src={`http://localhost:8000/api/audio/${note.id}`} />

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
