import React, { createContext, useContext, useState, useEffect } from "react";

interface Note {
  id: number;
  title: string;
  content: string;
  summary: string;
  language: string;
  created_at: string;
}

interface NotesContextType {
  notes: Note[];
  currentNote: Note | null;
  setCurrentNote: (note: Note | null) => void;
  addNote: (note: Note) => void;
  fetchNote: (id: number) => Promise<Note | null>;
  fetchNotes: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);

  const fetchNotes = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/notes");
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const fetchNote = async (id: number): Promise<Note | null> => {
    try {
      const response = await fetch(`http://localhost:8000/api/notes/${id}`);
      if (!response.ok) throw new Error("Failed to fetch note");
      const note = await response.json();
      return note;
    } catch (error) {
      console.error("Error fetching note:", error);
      return null;
    }
  };

  const addNote = async (note: Note) => {
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== note.id);
      return [note, ...filtered];
    });
    await fetchNotes(); // Refresh notes from server
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  return (
    <NotesContext.Provider
      value={{
        notes,
        currentNote,
        setCurrentNote,
        addNote,
        fetchNote,
        fetchNotes,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useNotes = () => {
  const context = useContext(NotesContext);
  if (context === undefined) {
    throw new Error("useNotes must be used within a NotesProvider");
  }
  return context;
};
