import React, { useRef, useState } from "react";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  DocumentIcon,
  DocumentTextIcon,
  MusicalNoteIcon,
  ChevronUpIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import type { StreamingMessage, FileInfo } from "../types/types";
import { useNotes } from "../NotesContext";

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

const TranscriptionNew: React.FC = () => {
  const { fetchNotes } = useNotes();
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAudioFile = (file: File): boolean => {
    if (!file.type.startsWith("audio/")) {
      alert("Please upload an audio file (MP3, WAV, etc.)");
      return false;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert("File size must be less than 100MB");
      return false;
    }

    return true;
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
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
      audio.addEventListener("error", (error: Event | string) => {
        reject(new Error("Error loading audio file: " + error));
      });
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleFile = async (file: File): Promise<void> => {
    if (!validateAudioFile(file)) return;

    try {
      const duration = await getAudioDuration(file);
      if (duration > 3600) {
        alert("Audio duration must be less than 1 hour");
        return;
      }

      setFileInfo({ name: file.name, duration, size: file.size });
      setIsProcessing(true);
      setMessages([]);
      setDetectedLanguage(null);

      if (wsRef.current) wsRef.current.close();

      const ws = new WebSocket("ws://localhost:8000/ws/transcribe");
      wsRef.current = ws;

      ws.onopen = async () => {
        setMessages((prev) => [
          ...prev,
          {
            type: "status",
            content: "Connected to server, processing audio...",
          },
        ]);

        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          if (e.target?.result && ws.readyState === WebSocket.OPEN) {
            ws.send(e.target.result as ArrayBuffer);
            ws.send(new ArrayBuffer(0)); // Signal end of file
          }
        };
        reader.readAsArrayBuffer(file);
      };

      ws.onmessage = (event: MessageEvent) => {
        const message = event.data as string;

        if (message.startsWith("Detected language:")) {
          const lang = message.replace("Detected language:", "").trim();
          setDetectedLanguage(lang);
          return;
        }

        setMessages((prev) => {
          const newMessages = [...prev];

          if (message.startsWith("title:")) {
            return [
              ...newMessages,
              {
                type: "status" as const,
                content: `Generated title: ${message
                  .replace("title:", "")
                  .trim()}`,
              },
            ];
          }

          if (message.startsWith("note_id:")) {
            const noteId = parseInt(message.replace("note_id:", "").trim());
            if (!isNaN(noteId)) {
              // Trigger fetch of the newly created note
              fetchNotes();
            }
            return newMessages;
          }

          if (message.includes("Starting") || message.includes("Generating")) {
            return [
              ...newMessages,
              {
                type: "status" as const,
                content: message,
              },
            ];
          }

          if (message.includes("Transcription completed")) {
            return [
              ...newMessages,
              {
                type: "status" as const,
                content: message,
                metadata: {
                  completionTime: Number(message.match(/\d+\.\d+/)?.[0]),
                },
              },
            ];
          }

          const lastMessage = newMessages[newMessages.length - 1];
          if (message.startsWith("# ") || lastMessage?.type === "summary") {
            // Start new summary or append to existing
            if (!lastMessage?.type || lastMessage.type !== "summary") {
              return [
                ...newMessages,
                {
                  type: "summary" as const,
                  content: message,
                },
              ];
            } else {
              // Append to existing summary, preserving newlines
              const updatedContent =
                lastMessage.content +
                (message.trim().startsWith("#") ? "\n\n" : "\n") +
                message.trim();
              newMessages[newMessages.length - 1] = {
                type: "summary" as const,
                content: updatedContent,
              };
              return newMessages;
            }
          }

          if (message.trim()) {
            if (lastMessage?.type === "transcription") {
              newMessages[newMessages.length - 1] = {
                type: "transcription" as const,
                content: lastMessage.content + " " + message.trim(),
              };
              return newMessages;
            }
            return [
              ...newMessages,
              {
                type: "transcription" as const,
                content: message.trim(),
              },
            ];
          }

          return newMessages;
        });
      };

      ws.onclose = () => {
        setIsProcessing(false);
      };

      ws.onerror = (error: Event) => {
        console.error("WebSocket error:", error);
        setMessages((prev) => [
          ...prev,
          {
            type: "status" as const,
            content: "Error occurred during processing",
          },
        ]);
        setIsProcessing(false);
      };
    } catch (error) {
      console.error("Error processing file:", error);
      setMessages([
        {
          type: "status" as const,
          content: `Error processing file: ${error}`,
        },
      ]);
      setIsProcessing(false);
    }
  };

  const resetFile = (): void => {
    setFileInfo(null);
    setMessages([]);
    setIsProcessing(false);
    setDetectedLanguage(null);
    if (wsRef.current) wsRef.current.close();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const transcriptionMessage = messages.find(
    (m: StreamingMessage): m is StreamingMessage & { type: "transcription" } =>
      m.type === "transcription"
  );

  const summaryMessage = messages.find(
    (m: StreamingMessage): m is StreamingMessage & { type: "summary" } =>
      m.type === "summary"
  );

  const completionMessage = messages.find(
    (
      m: StreamingMessage
    ): m is StreamingMessage & {
      type: "status";
      metadata: { completionTime: number };
    } => m.type === "status" && !!m.metadata?.completionTime
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
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform your audio lectures into well-structured, academic notes
            using AI. Simply upload your recording and watch the magic happen.
          </p>
        </header>
        <div className="relative group">
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  e.target.files?.[0] && handleFile(e.target.files[0])
                }
                className="hidden"
              />
              <div className="text-center">
                <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-1">
                  Drop your audio file here
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse (MP3, WAV)
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MusicalNoteIcon className="h-8 w-8 text-indigo-500" />
                <div>
                  <p className="font-medium text-gray-900">{fileInfo.name}</p>
                  <div className="text-sm text-gray-500">
                    {fileInfo.duration &&
                      `Duration: ${formatDuration(fileInfo.duration)}`}
                    <br />
                    Size: {formatFileSize(fileInfo.size)}
                    {detectedLanguage && (
                      <>
                        <br />
                        Language:{" "}
                        {new Intl.DisplayNames([navigator.language || "en"], {
                          type: "language",
                        }).of(detectedLanguage)}
                      </>
                    )}
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
        </div>

        {messages.length > 0 && (
          <div className="mt-8 space-y-6">
            {messages.some(
              (m) => m.type === "status" && !m.content.includes("completed")
            ) && (
              <div className="text-sm text-gray-600">
                {messages
                  .filter(
                    (m) =>
                      m.type === "status" && !m.content.includes("completed")
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
                    {summaryMessage.content}
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
          <a
            href="https://github.com/maciekt07"
            className="hover:text-gray-700"
          >
            maciekt07
          </a>
        </footer>
      </div>
    </div>
  );
};

export default TranscriptionNew;
