import React, { useState, useRef, useEffect } from "react";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { useNotes } from "../NotesContext";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  DocumentTextIcon,
  ChevronUpIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { FileInfo, StreamingMessage } from "../types/types";

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const TranscriptionNew = () => {
  const { addNote, setCurrentNote } = useNotes();
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptionStartTime = useRef<number>(0);
  const noteSummaryRef = useRef<string>("");
  const processingNoteRef = useRef<number | null>(null);

  // reconnect ws if connection is lost
  useEffect(() => {
    if (isProcessing && !wsConnected && processingNoteRef.current) {
      const ws = new WebSocket("ws://localhost:8000/ws/transcribe");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket reconnected");
        setWsConnected(true);
      };

      ws.onclose = () => {
        console.log("WebSocket connection lost");
        setWsConnected(false);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }
  }, [isProcessing, wsConnected]);

  const validateAudioFile = (file: File): boolean => {
    if (!file.type.startsWith("audio/")) {
      alert("Please upload an audio file (MP3, WAV, etc.)");
      return false;
    }

    // max 100MB
    if (file.size > 100 * 1024 * 1024) {
      alert("File size must be less than 100MB");
      return false;
    }

    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const getAudioDuration = async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();

      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration);
      });

      audio.addEventListener("error", (error) => {
        reject(new Error("Error loading audio file: " + error));
      });

      audio.src = URL.createObjectURL(file);
    });
  };

  const formatMarkdown = (content: string): string => {
    return content.replace(/\\n/g, "\n").replace(/\n+/g, "\n").trim();
  };

  const uploadFile = async (file: File, ws: WebSocket): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const chunkSize = 1024 * 1024; // 1MB chunks
      let offset = 0;

      reader.onerror = () => {
        reject(new Error("Error reading file"));
      };

      reader.onload = (e) => {
        try {
          if (e.target?.result && ws.readyState === WebSocket.OPEN) {
            ws.send(e.target.result as ArrayBuffer);
            offset += chunkSize;

            const progress = Math.min(
              100,
              Math.round((offset / file.size) * 100)
            );
            setUploadProgress(progress);

            if (offset < file.size) {
              readNextChunk();
            } else {
              ws.send(new ArrayBuffer(0));
              resolve();
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      const readNextChunk = () => {
        const slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
      };

      readNextChunk();
    });
  };

  const handleFile = async (file: File) => {
    console.log("File received:", file.name, file.type, file.size);

    if (!validateAudioFile(file)) {
      return;
    }

    try {
      const duration = await getAudioDuration(file);
      console.log("Audio duration:", duration, "seconds");

      if (duration > 3600) {
        alert("Audio duration must be less than 1 hour");
        return;
      }

      setFileInfo({ name: file.name, duration, size: file.size });
      setIsProcessing(true);
      setMessages([]);
      transcriptionStartTime.current = Date.now();

      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket("ws://localhost:8000/ws/transcribe");
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("WebSocket opened, sending file...");
        setMessages((prev) => [
          ...prev,
          {
            type: "status",
            content: "Connected to server, starting upload...",
          },
        ]);

        try {
          await uploadFile(file, ws);
          console.log("File sent successfully");
        } catch (error) {
          console.error("Error sending file:", error);
          setMessages((prev) => [
            ...prev,
            { type: "status", content: `Error sending file: ${error}` },
          ]);
          setIsProcessing(false);
        }
      };

      ws.onmessage = (event) => {
        console.log("Received message:", event.data);
        const message = event.data as string;
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];

          if (message.startsWith("title:")) {
            const title = message.replace("title:", "").trim();
            setCurrentTitle(title);
            return [
              ...prev,
              { type: "status", content: `Generated title: ${title}` },
            ];
          }

          if (message.startsWith("note_id:")) {
            const noteId = parseInt(message.replace("note_id:", "").trim());
            if (!isNaN(noteId)) {
              const newNote = {
                id: noteId,
                title: currentTitle,
                content: noteSummaryRef.current,
                language: "en",
                created_at: new Date().toISOString(),
              };
              addNote(newNote);
              setCurrentNote(newNote); ////FIXME: auto-refresh
            }
            return prev;
          }

          if (message.includes("Progress:")) {
            return [...prev, { type: "status", content: message }];
          }

          if (
            message.includes("Starting") ||
            message.includes("received") ||
            message.includes("Generating")
          ) {
            return [...prev, { type: "status", content: message }];
          }

          if (message.includes("Transcription completed in")) {
            const completionTime =
              (Date.now() - transcriptionStartTime.current) / 1000;
            return [
              ...prev,
              {
                type: "status",
                content: message,
                metadata: { completionTime },
              },
            ];
          }

          if (
            message.startsWith("#") ||
            message.startsWith("-") ||
            message.startsWith("*") ||
            lastMessage?.type === "summary"
          ) {
            if (lastMessage?.type === "summary") {
              const updatedContent = lastMessage.content + message;
              noteSummaryRef.current = updatedContent;
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                type: "summary",
                content: updatedContent,
              };
              return newMessages;
            }
            noteSummaryRef.current = message;
            return [...prev, { type: "summary", content: message }];
          }

          if (message.trim()) {
            if (lastMessage?.type === "transcription") {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                type: "transcription",
                content: lastMessage.content + " " + message.trim(),
              };
              return newMessages;
            }

            if (
              !message.startsWith("#") &&
              !message.startsWith("-") &&
              !message.startsWith("*")
            ) {
              return [
                ...prev,
                { type: "transcription", content: message.trim() },
              ];
            }
          }

          return prev;
        });
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsProcessing(false);
        setUploadProgress(0);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setMessages((prev) => [
          ...prev,
          { type: "status", content: "Error occurred during processing" },
        ]);
        setIsProcessing(false);
        setUploadProgress(0);
      };
    } catch (error) {
      console.error("Error processing file:", error);
      setMessages([
        { type: "status", content: `Error processing file: ${error}` },
      ]);
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };

  const resetFile = () => {
    setFileInfo(null);
    setMessages([]);
    setIsProcessing(false);
    setUploadProgress(0);
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const transcriptionMessage = messages.find((m) => m.type === "transcription");
  const summaryMessage = messages.find((m) => m.type === "summary");
  const completionMessage = messages.find(
    (m) => m.type === "status" && m.metadata?.completionTime
  );

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h1 className="text-4xl font-bold text-gray-900 font-display">
              AI Lecture Note Generator
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto flex items-center justify-center gap-2">
            Transform your audio lectures into well-structured, academic notes
            using AI. Simply upload your recording and watch the magic happen.
          </p>
        </header>
      </div>
      <div
        className={`relative group ${
          isProcessing ? "pointer-events-none opacity-50" : ""
        }`}
      >
        {!fileInfo ? (
          <div
            className={`flex flex-col items-center justify-center w-full min-h-[200px] p-6 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out ${
              dragActive
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
              className="hidden"
            />
            <div className="text-center">
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-1">
                Drop your audio file here
              </p>
              <p className="text-sm text-gray-500">or click to browse (MP3)</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MusicalNoteIcon className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="font-medium text-gray-900">{fileInfo.name}</p>
                <div className="text-sm text-gray-500">
                  {fileInfo.duration && (
                    <p>Duration: {formatDuration(fileInfo.duration)}</p>
                  )}
                  <p>Size: {formatFileSize(fileInfo.size)}</p>
                </div>
              </div>
            </div>
            {!isProcessing && (
              <button
                onClick={resetFile}
                className="p-1 text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Uploading: {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      {messages.length > 0 && (
        <div className="mt-8 space-y-6">
          {messages.some(
            (m) => m.type === "status" && !m.content.includes("completed")
          ) && (
            <div className="text-sm text-gray-600">
              {messages
                .filter(
                  (m) => m.type === "status" && !m.content.includes("completed")
                )
                .map((m, i) => (
                  <div key={i} className="mb-2 flex items-center space-x-2">
                    <DocumentTextIcon className="h-4 w-4 text-gray-400" />
                    <span>{m.content}</span>
                  </div>
                ))}
            </div>
          )}

          {transcriptionMessage && completionMessage && (
            <Disclosure>
              {({ open }) => (
                <>
                  <DisclosureButton className="flex w-full justify-between rounded-lg bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus-visible:ring focus-visible:ring-indigo-500 focus-visible:ring-opacity-75">
                    <div className="flex items-center space-x-2">
                      <DocumentIcon className="h-5 w-5 text-gray-500" />
                      <span>
                        Transcription done in{" "}
                        {completionMessage.metadata?.completionTime
                          ? `${completionMessage.metadata.completionTime.toFixed(
                              1
                            )}s`
                          : ""}
                      </span>
                    </div>
                    <ChevronUpIcon
                      className={`${
                        open ? "" : "rotate-180 transform"
                      } h-5 w-5 text-gray-500`}
                    />
                  </DisclosureButton>
                  <DisclosurePanel className="px-4 pt-4 pb-2 text-gray-600">
                    {transcriptionMessage.content}
                  </DisclosurePanel>
                </>
              )}
            </Disclosure>
          )}

          {summaryMessage && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <SparklesIcon className="h-5 w-5 text-purple-500" />
                <span>Generated Notes</span>
              </h3>
              <div className="prose prose-indigo max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {formatMarkdown(summaryMessage.content)}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="mt-8 flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-gray-600">Processing your audio...</span>
        </div>
      )}
      <footer className="mt-12 text-center text-gray-500 text-sm">
        Powered by Whisper & Llama 3.1-8B • Made with ❤️ by{" "}
        <a href="https://github.com/maciekt07" target="_blank">
          maciekt07
        </a>
      </footer>
    </div>
  );
};

export default TranscriptionNew;
