export interface StreamingMessage {
  type: "status" | "transcription" | "summary";
  content: string;
  metadata?: {
    completionTime?: number;
  };
}

export interface FileInfo {
  name: string;
  duration: number | null;
  size: number;
}
