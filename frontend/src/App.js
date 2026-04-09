// src/App.js
import React, { useState, useRef, useEffect } from "react";
import "./index.css";

import { supabase } from "./supabaseClient";

import { LoginPage } from "./figma-ui/components/LoginPage";
import { HomePage } from "./figma-ui/components/HomePage";
import { DashboardPage } from "./figma-ui/components/DashboardPage";

// Base URL for backend (local + deployed)
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:5000";

function App() {
  // App routing: login -> home -> dashboard
  // "loading" while we check for an existing session
  const [currentPage, setCurrentPage] = useState("loading");

  // recording + backend state
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecordingData, setHasRecordingData] = useState(false);

  const [connectedDevices, setConnectedDevices] = useState([
    {
      id: "1",
      name: "Teacher Device",
      status: "connected",
      type: "teacher",
      audioLevel: 0,
    },
  ]);

  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const levelIntervalRef = useRef(null);

  // --- SESSION PERSISTENCE ---
  // Check for an existing Supabase session on mount so a page refresh
  // doesn't force the user back to the login screen.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentPage(session ? "home" : "login");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) setCurrentPage("login");
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // --- fake audio level animation for devices ---
  const startAudioLevelSimulation = () => {
    if (levelIntervalRef.current) return;

    levelIntervalRef.current = setInterval(() => {
      setConnectedDevices((prev) =>
        prev.map((device) => ({
          ...device,
          audioLevel:
            device.type === "teacher"
              ? 60 + Math.random() * 40
              : Math.random() * 40,
        }))
      );
    }, 200);
  };

  const stopAudioLevelSimulation = () => {
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current);
      levelIntervalRef.current = null;
    }
    setConnectedDevices((prev) =>
      prev.map((device) => ({
        ...device,
        audioLevel: 0,
      }))
    );
  };

 // --- BACKEND CALLS ---
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [availableLanguages, setAvailableLanguages] = useState([]);

  // Fetch supported languages from backend on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/languages`)
      .then((res) => res.json())
      .then((data) => setAvailableLanguages(data.languages || []))
      .catch((err) => console.warn("Could not fetch languages:", err));
  }, []);

  const sendToBackend = async (audioBlob) => {
    // Step 1 — Build form data with language hint
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("language", selectedLanguage || "auto");

    // Step 2 — Transcribe
    let transcriptText = "";
    let langCode = "en";

    try {
      const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("Transcribe error status:", response.status);
        alert("Error while transcribing audio");
        return;
      }

      const data = await response.json();
      console.log("Transcribe response:", data);

      // Accept multiple possible field names
      transcriptText = data.transcript || data.text || data.result || "";
      langCode = data.detected_language || selectedLanguage || "en";

      if (!transcriptText) {
        console.error("No transcript in response:", data);
        alert(data.error || "Backend returned no transcript text.");
        return;
      }

      setTranscript(transcriptText);
      setDetectedLanguage(langCode);
      setHasRecordingData(true);

    } catch (err) {
      console.error(err);
      alert("Could not reach backend for transcription");
      return;
    }

    // Step 3 — Generate Notes from backend
    try {
      const notesRes = await fetch(`${API_BASE_URL}/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          language: langCode,
          detected_language: langCode,
        }),
      });

      const notesData = await notesRes.json();
      if (notesData.notes) {
        // Split notes into bullet points for display
        const noteLines = notesData.notes
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        setNotes(noteLines.slice(0, 8));
      }
    } catch (err) {
      console.warn("Notes generation failed, using fallback:", err);
      // Fallback — basic text split
      const sentences = transcriptText
        .split(/[.!?]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      setNotes(sentences.slice(0, 6));
    }

    // Step 4 — Generate Flashcards from backend
    try {
      const flashRes = await fetch(`${API_BASE_URL}/generate-flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcriptText,
          language: langCode,
          detected_language: langCode,
        }),
      });

      const flashData = await flashRes.json();
      if (flashData.flashcards && Array.isArray(flashData.flashcards)) {
        const formatted = flashData.flashcards.map((fc, idx) => ({
          id: idx + 1,
          front: fc.question,
          back: fc.answer,
        }));
        setFlashcards(formatted);
      }
    } catch (err) {
      console.warn("Flashcard generation failed, using fallback:", err);
      // Fallback — basic generation
      const sentences = transcriptText
        .split(/[.!?]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const fallbackCards = sentences.slice(0, 8).map((s, idx) => ({
        id: idx + 1,
        front: `Point ${idx + 1}`,
        back: s,
      }));
      setFlashcards(fallbackCards);
    }
  };

  const handleSummarize = async () => {
    if (!transcript) {
      alert("No transcript available. Please record audio first.");
      return;
    }
    setIsSummarizing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          language: detectedLanguage || selectedLanguage || "en",
          detected_language: detectedLanguage || selectedLanguage || "en",
        }),
      });

      if (!response.ok) {
        console.error("Summary error status:", response.status);
        alert("Error while generating summary");
        return;
      }

      const data = await response.json();
      console.log("Summary response:", data);

      // Accept multiple possible field names
      const summaryText = data.summary || data.text || data.result || "";

      if (summaryText) {
        setSummary(summaryText);  // ← this updates the UI
      } else {
        alert("Backend returned no summary.");
      }

    } catch (err) {
      console.error(err);
      alert("Could not reach backend for summary");
    } finally {
      setIsSummarizing(false);
    }
  };
  const handleDownloadPdf = async () => {
    if (!transcript) {
      alert("No transcript available to download.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          summary,
          notes,
          flashcards,
          language: detectedLanguage || selectedLanguage || "en",
        }),
      });

      if (response.ok) {
        // Download the PDF file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "audique-notes.pdf";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Fallback — generate PDF from browser
        handleDownloadPdfFallback();
      }

    } catch (err) {
      console.warn("PDF backend failed, using browser fallback:", err);
      handleDownloadPdfFallback();
    }
  };

  // Fallback — generates PDF directly in browser without backend
  const handleDownloadPdfFallback = () => {
    const content = `
  AUDIQUE - LECTURE NOTES
  =======================

  TRANSCRIPT:
  ${transcript}

  SUMMARY:
  ${summary || "Not generated yet"}

  NOTES:
  ${notes.join("\n")}

  FLASHCARDS:
  ${flashcards.map((fc, i) => `Q${i + 1}: ${fc.front}\nA${i + 1}: ${fc.back}`).join("\n\n")}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audique-notes.txt";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
  // --- RECORDING HANDLERS ---
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        stream.getTracks().forEach((t) => t.stop());

        await sendToBackend(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      startAudioLevelSimulation();
    } catch (err) {
      alert("Could not access microphone");
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    stopAudioLevelSimulation();
  };

  const handleAddDevice = (deviceName) => {
    setConnectedDevices((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: deviceName,
        status: "connected",
        type: "student",
        audioLevel: 0,
      },
    ]);
  };

  const goToDashboard = () => setCurrentPage("dashboard");
  const goToHome = () => setCurrentPage("home");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentPage("login");
  };

return (
    <>
      {currentPage === "loading" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050116" }}>
          <p style={{ color: "#a78bfa" }}>Loading…</p>
        </div>
      )}

      {currentPage === "login" && (
        <LoginPage onLoginSuccess={() => setCurrentPage("home")} />
      )}

      {currentPage === "home" && (
        <HomePage
          isRecording={isRecording}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          connectedDevices={connectedDevices}
          onAddDevice={handleAddDevice}
          hasRecordingData={hasRecordingData}
          onNavigateToDashboard={goToDashboard}
          onLogout={handleLogout}
          availableLanguages={availableLanguages}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          detectedLanguage={detectedLanguage}
        />
      )}

      {currentPage === "dashboard" && (
        <DashboardPage
          onNavigateToHome={goToHome}
          hasRecordingData={hasRecordingData}
          transcript={transcript}
          summary={summary}
          notes={notes}
          flashcards={flashcards}
          onSummarize={handleSummarize}
          isSummarizing={isSummarizing}
          onDownloadPdf={handleDownloadPdf}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
      // ← closes the function
export default App;