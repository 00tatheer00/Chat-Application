import { useState, useEffect } from 'react';
import { MessageCircle, Check, Wifi, WifiOff } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import Avatar from '../components/Avatar';

const AVATAR_COLORS = [
  '#ef5350', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ff9800', '#ff5722', '#795548',
];

const SUGGESTIONS = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Drew'];

export default function LoginScreen({ onBack }) {
  const [username, setUsername] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[5]);
  const [shake, setShake] = useState(false);
  const { joinChat, isLoading, error } = useChat();

  // Trigger shake on error
  useEffect(() => {
    if (error) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    joinChat(trimmed, selectedColor);
  };

  const randomSuggestion = () => {
    const s = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
    setUsername(s);
  };

  const initials = username.trim().slice(0, 2).toUpperCase() || '?';

  return (
    <div className="login-screen">
      {/* Animated background blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className={`login-card ${shake ? 'shake' : ''}`}>
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <MessageCircle size={38} strokeWidth={1.5} color="white" />
          </div>
          <h1 className="login-title">TatheerApp</h1>
          <p className="login-subtitle">Real-time chat — fast, beautiful, open.</p>
        </div>

        {/* Live avatar preview */}
        <div className="avatar-preview">
          <div className="avatar-preview-ring" style={{ borderColor: selectedColor + '55' }}>
            <Avatar name={username || '?'} color={selectedColor} size="xl" />
          </div>
          <p className="avatar-preview-label">
            {username.trim() || 'Your display name'}
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="login-error">
            <WifiOff size={14} />
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Username input */}
          <div className="login-input-group">
            <label className="login-label" htmlFor="username">Display Name</label>
            <div style={{ position: 'relative' }}>
              <input
                id="username"
                className="login-input"
                type="text"
                placeholder="Enter your name…"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                autoFocus
                autoComplete="off"
              />
              <button
                type="button"
                className="suggest-btn"
                onClick={randomSuggestion}
                title="Random suggestion"
              >
                🎲
              </button>
            </div>
            <span className="char-count">{username.length}/20</span>
          </div>

          {/* Color picker */}
          <div>
            <p className="color-picker-label">Avatar Color</p>
            <div className="color-picker">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${selectedColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  title={color}
                >
                  {selectedColor === color && (
                    <Check size={14} color="white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="login-btn"
            disabled={username.trim().length < 2 || isLoading}
          >
            {isLoading ? (
              <span className="login-btn-loading">
                <span className="spinner-sm" />
                Connecting…
              </span>
            ) : (
              <>
                <Wifi size={16} />
                Join Chat
              </>
            )}
          </button>
        </form>

        <p className="login-footer">
          No sign-up required. Your name is your identity.
        </p>
        {onBack && (
          <button type="button" className="link-btn" onClick={onBack} style={{ marginTop: 12 }}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
