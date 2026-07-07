import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { httpsCallable } from 'firebase/functions';
import { Capacitor, registerPlugin } from "@capacitor/core";
import { cloudFunctions } from '../firebase';
import './ChatBox.css';

const NativeSpeech = registerPlugin("NativeSpeech");
const isAndroidApp = Capacitor.getPlatform() === "android";

function getAIResponseText(result) {
  let text = result?.text || result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  
  // Attempt to extract JSON from markdown code blocks
  let cleanText = text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match) {
    cleanText = match[1].trim();
  }

  try {
    const parsed = JSON.parse(cleanText);
    if (parsed && typeof parsed === 'object') {
      text = parsed.text || parsed.message || parsed.response || parsed.reply || Object.values(parsed).filter(v => typeof v === 'string').join('\n') || text;
    }
  } catch (e) {
    // Not JSON, which is fine
  }
  return text;
}

export default function ChatBox({ user, readingList, savedFiles }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'model', text: 'Hi! I am Lumina, your virtual librarian. 📚 How can I help you find your next read?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const originalInputRef = useRef('');

  const startListening = async () => {
    if (isListening) return;
    originalInputRef.current = input;

    if (isAndroidApp && NativeSpeech?.start) {
      setIsListening(true);
      try {
        const result = await NativeSpeech.start({ language: "en-US" });
        const transcript = String(result?.transcript || "").trim();
        if (transcript) {
          setInput(prev => prev ? prev + ' ' + transcript : transcript);
        }
      } catch (err) {
        console.error("Native voice search failed:", err);
        alert("Voice search failed or permission denied.");
      } finally {
        setIsListening(false);
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input.");
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.error("Microphone permission failed:", err);
        alert("Microphone permission is needed. Allow microphone access in your browser.");
        return;
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const currentTranscript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")
        .trim();
      
      const combined = originalInputRef.current
        ? originalInputRef.current + ' ' + currentTranscript
        : currentTranscript;

      setInput(combined);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    
    setIsLoading(true);

    try {
      // Build context
      const readingListContext = readingList?.length > 0 
        ? `User's Reading List titles: ${readingList.map(b => b.title).join(', ')}.` 
        : '';
        
      const systemPrompt = `You are Lumina, a helpful Gen Z virtual librarian in the BookCompass app. Keep your answers relatively short, friendly, and use emojis. Context: ${readingListContext}`;

      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const callable = httpsCallable(cloudFunctions, "generateGeminiContent");
      const response = await callable({ contents, callType: "Chat" });
      
      const botResponse = getAIResponseText(response.data);

      if (botResponse) {
        setMessages((prev) => [...prev, { role: 'model', text: botResponse }]);
      } else {
        setMessages((prev) => [...prev, { role: 'model', text: 'Sorry, I got confused there! Try again? 😅' }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { role: 'model', text: 'Oops, something went wrong on my end! 🛑' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbox-container">
      {!isOpen && (
        <button className="chatbox-fab" onClick={() => setIsOpen(true)}>
          ✨ Chat
        </button>
      )}

      {isOpen && (
        <div className="chatbox-window">
          <div className="chatbox-header">
            <h3>✨ Lumina</h3>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="chatbox-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chatbox-message ${msg.role}`}>
                <div className="chatbox-bubble"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
              </div>
            ))}
            {isLoading && (
              <div className="chatbox-message model">
                <div className="chatbox-bubble typing">...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbox-input">
            <input
              type="text"
              placeholder="Ask about books..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              className={`chatbox-mic-button ${isListening ? 'listening' : ''}`}
              onClick={startListening}
              title="Voice Input"
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
            <button className="chatbox-send-button" onClick={handleSend} disabled={isLoading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
