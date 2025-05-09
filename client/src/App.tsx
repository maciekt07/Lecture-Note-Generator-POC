import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotesProvider } from "./NotesContext";
import Layout from "./components/Layout";
import TranscriptionNew from "./pages/TranscriptionNew";
import NoteView from "./pages/NoteView";

function App() {
  return (
    <NotesProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<TranscriptionNew />} />
            <Route path="notes/:noteId" element={<NoteView />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </NotesProvider>
  );
}

export default App;
