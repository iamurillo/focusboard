import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';

export default function Chatbot({ token }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{
    id: 1, text: '¡Hola! Soy tu asistente IA de FocusBoard. ¿En qué te ayudo hoy?', sender: 'bot'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:3001/api/external/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage.text })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de red');

      setMessages(prev => [...prev, { id: Date.now(), text: data.reply, sender: 'bot' }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now(), text: `Error: ${error.message}`, sender: 'bot' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed', bottom: '2rem', right: '2rem',
            width: '60px', height: '60px', borderRadius: '50%',
            background: 'var(--accent-gradient)', color: 'white',
            border: 'none', boxShadow: 'var(--shadow-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 1000,
            transition: 'transform 0.2s ease'
          }}
          className="chatbot-fab"
        >
          <Bot size={28} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          width: '350px', height: '500px',
          background: 'var(--bg-board)',
          border: '1px solid var(--border-highlight)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.05)',
          display: 'flex', flexDirection: 'column',
          zIndex: 1000, overflow: 'hidden',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem', background: 'rgba(0,0,0,0.2)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Bot size={20} color="var(--accent-primary)" />
              FocusBot
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, padding: '1rem', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}>
            {messages.map(m => (
              <div key={m.id} style={{
                alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                background: m.sender === 'user' ? 'var(--accent-gradient)' : 'var(--bg-card)',
                color: m.sender === 'user' ? 'white' : 'var(--text-main)',
                padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                maxWidth: '85%', fontSize: '0.9rem',
                border: m.sender === 'bot' ? '1px solid var(--border-color)' : 'none'
              }}>
                {m.text}
              </div>
            ))}
            {isLoading && (
              <div style={{
                alignSelf: 'flex-start', background: 'var(--bg-card)',
                padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem', color: 'var(--text-muted)'
              }}>
                Escribiendo...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{
            padding: '1rem', borderTop: '1px solid var(--border-color)',
            display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)'
          }}>
            <input 
              type="text" 
              placeholder="Pregúntale a Gemini..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={isLoading}
              style={{
                flex: 1, padding: '0.5rem 1rem', borderRadius: '999px',
                border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                color: 'var(--text-main)', outline: 'none'
              }}
            />
            <button 
              type="submit" 
              disabled={isLoading}
              style={{
                background: 'var(--accent-primary)', color: 'white',
                border: 'none', borderRadius: '50%',
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
