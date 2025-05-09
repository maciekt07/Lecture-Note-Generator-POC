import React from "react";
import { useNotes } from "../NotesContext";
import { ClockIcon } from "@heroicons/react/24/outline";
import { useNavigate, useParams } from "react-router-dom";

const Sidebar: React.FC = () => {
  const { notes } = useNotes();
  const navigate = useNavigate();
  const { noteId } = useParams();
  //FIXME: redesign
  return (
    <div className="w-64 h-full bg-white shadow-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Note History</h2>
        </div>

        <nav className="space-y-1">
          <button
            onClick={() => navigate("/")}
            className={`w-full text-left p-3 rounded-lg transition-colors duration-150 hover:bg-gray-50 text-gray-700`}
          >
            New Transcription
          </button>

          <div className="border-t my-2" />

          <div className="space-y-1">
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className={`w-full text-left p-3 rounded-lg transition-colors duration-150 ${
                  noteId === note.id?.toString()
                    ? "bg-indigo-50 text-indigo-700"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <div className="font-medium truncate">{note.title}</div>
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  {new Date(note.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;
