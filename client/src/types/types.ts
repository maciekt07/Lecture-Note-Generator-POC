export interface Note {
  id: number;
  title: string;
  content: string;
  summary: string;
  language: string;
  created_at: string;
}

export interface StreamingMessage {
  type: "status" | "transcription" | "note" | "summary";
  content: string;
  metadata?: {
    language?: string;
    title?: string;
    completionTime?: number;
  };
}

export interface FileInfo {
  name: string;
  duration: number | null;
  size: number;
}
