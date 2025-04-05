import React, { useState, useRef } from "react";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  DocumentTextIcon,
  ChevronUpIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

interface StreamingMessage {
  type: "status" | "transcription" | "summary";
  content: string;
  metadata?: {
    completionTime?: number;
  };
}

interface FileInfo {
  name: string;
  duration: number | null;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const Transcription: React.FC = () => {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptionStartTime = useRef<number>(0);

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

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration);
      });
      audio.src = URL.createObjectURL(file);
    });
  };

  const formatMarkdown = (content: string): string => {
    return content.replace(/\\n/g, "\n").replace(/\n+/g, "\n").trim();
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      alert("Please upload an audio file.");
      return;
    }

    const duration = await getAudioDuration(file);
    setFileInfo({ name: file.name, duration });

    setIsProcessing(true);
    setMessages([]);
    transcriptionStartTime.current = Date.now();

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket("ws://localhost:8000/ws/transcribe");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket opened, sending file...");
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && ws.readyState === WebSocket.OPEN) {
          ws.send(reader.result as ArrayBuffer);
          ws.send(new ArrayBuffer(0));
        }
      };
      reader.readAsArrayBuffer(file);
    };

    ws.onmessage = (event) => {
      const message = event.data as string;
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];

        if (
          message.includes("Starting") ||
          message.includes("received") ||
          message.includes("Generating") ||
          message.includes("Progress:")
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
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              type: "summary",
              content: lastMessage.content + message,
            };
            return newMessages;
          }
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
          return [...prev, { type: "transcription", content: message.trim() }];
        }

        return prev;
      });
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setIsProcessing(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setMessages((prev) => [
        ...prev,
        { type: "status", content: "Error occurred during processing" },
      ]);
      setIsProcessing(false);
    };
  };

  const resetFile = () => {
    setFileInfo(null);
    setMessages([]);
    setIsProcessing(false);
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
                {fileInfo.duration && (
                  <p className="text-sm text-gray-500">
                    Duration: {formatDuration(fileInfo.duration)}
                  </p>
                )}
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
    </div>
  );
};

export default Transcription;
