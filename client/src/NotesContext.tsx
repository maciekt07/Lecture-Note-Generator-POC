import React, { createContext, useContext, useState, useEffect } from "react";

interface Note {
  id: number;
  title: string;
  content: string;
  language: string;
  created_at: string;
}

interface NotesContextType {
  notes: Note[];
  currentNote: Note | null;
  setCurrentNote: (note: Note | null) => void;
  addNote: (note: Note) => void;
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
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error("Error fetching notes:", error);
    }
  };

  const addNote = (note: Note) => {
    setNotes((prev) => {
      const filtered = prev.filter((n) => n.id !== note.id);
      return [note, ...filtered];
    });
  };

  //FIXME: temp solution but still kinda broken
  useEffect(() => {
    if (currentNote) {
      const interval = setInterval(fetchNotes, 5000);
      return () => clearInterval(interval);
    }
  }, [currentNote]);

  useEffect(() => {
    fetchNotes();
  }, []);

  return (
    <NotesContext.Provider
      value={{ notes, currentNote, setCurrentNote, addNote, fetchNotes }}
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
