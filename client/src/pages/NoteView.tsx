import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useNotes } from "../NotesContext";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import AudioPlayer from "../components/AudioPlayer";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const NoteView = () => {
  const { noteId } = useParams();
  const navigate = useNavigate();
  const { notes, addNote } = useNotes();
  // FIXME: display full markdown content
  // fetch updated note content
  useEffect(() => {
    if (noteId) {
      const fetchUpdatedNote = async () => {
        try {
          const response = await fetch(
            `http://localhost:8000/api/notes/${noteId}`
          );
          const data = await response.json();
          if (data) {
            addNote(data);
          }
        } catch (error) {
          console.error("Error fetching updated note:", error);
        }
      };
      fetchUpdatedNote();

      //FIXME:
      const interval = setInterval(fetchUpdatedNote, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const note = notes.find((n) => n.id === Number(noteId));

  if (!note) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Note not found</h2>
      </div>
    );
  }

  let description = "";
  let mainContent = note.content;

  const descriptionMatch = note.content.match(/\n_(.*?)_\n/);
  if (descriptionMatch) {
    description = descriptionMatch[1];
    mainContent = note.content.replace(/\n_(.*?)_\n/, "\n");
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/")}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="h-5 w-5 mr-2" />
        Back to Transcription
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{note.title}</h1>
        <div></div>
        <div className="text-sm text-gray-500 mb-4">
          Created on {new Date(note.created_at).toLocaleDateString()} <br />
          Language:{" "}
          {new Intl.DisplayNames([navigator.language || "en"], {
            type: "language",
          }).of(note.language)}
        </div>

        {description && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-gray-700 italic">{description}</p>
          </div>
        )}

        <AudioPlayer src={`http://localhost:8000/api/audio/${note.id}`} />

        <div className="prose prose-indigo max-w-none mt-6">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {mainContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default NoteView;
