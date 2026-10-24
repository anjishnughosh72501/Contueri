import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Member } from '@contueri/shared';

interface ChatProps {
  messages: ChatMessage[];
  currentMemberName: string;
  typingMembers: Record<string, boolean>;
  members: Member[];
  onSendMessage: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  currentMemberName,
  typingMembers,
  members,
  onSendMessage,
  onTyping,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('ct_chat_sound_muted') === 'true';
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingActiveRef = useRef<boolean>(false);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setChatInput(val);

    if (!isTypingActiveRef.current) {
      isTypingActiveRef.current = true;
      onTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingActiveRef.current = false;
      onTyping(false);
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingActiveRef.current = false;
    onTyping(false);

    onSendMessage(chatInput.trim());
    setChatInput('');
  };

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem('ct_chat_sound_muted', String(next));
  };

  // Compile typing text
  const typingNames = Object.entries(typingMembers)
    .filter(([_, typing]) => typing)
    .map(([id]) => members.find((m) => m.id === id)?.nickname)
    .filter(Boolean) as string[];

  let typingText = '';
  if (typingNames.length === 1) {
    typingText = `${typingNames[0]} is typing...`;
  } else if (typingNames.length > 1) {
    typingText = `${typingNames.length} people are typing...`;
  }

  return (
    <div className="sidebar-panel">
      <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Lounge Chat</span>
        <button
          type="button"
          onClick={toggleSound}
          className="btn-secondary"
          style={{ padding: '0.15em 0.5em', fontSize: '0.7rem' }}
          title={isMuted ? 'Unmute chat sound' : 'Mute chat sound'}
          aria-label={isMuted ? 'Unmute chat sound' : 'Mute chat sound'}
        >
          {isMuted ? '🔇 Muted' : '🔔 Sound On'}
        </button>
      </div>

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="chat-system-line">
                <span>ℹ️</span> {msg.text}
              </div>
            );
          }

          const isMine = msg.nickname.toLowerCase() === currentMemberName.toLowerCase();

          return (
            <div key={msg.id} className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
              <div className="chat-bubble-author">
                <span>{msg.nickname}</span>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
              <span className="chat-bubble-time">
                {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-typing-bar">{typingText}</div>

      <form onSubmit={handleSend} className="chat-input-bar">
        <input
          type="text"
          value={chatInput}
          onChange={handleInputChange}
          placeholder="Say something to the room..."
          maxLength={500}
          aria-label="Chat message input"
        />
        <button type="submit" disabled={!chatInput.trim()} aria-label="Send message">
          Send
        </button>
      </form>
    </div>
  );
};
