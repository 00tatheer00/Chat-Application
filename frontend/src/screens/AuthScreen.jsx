import { useState, useEffect } from 'react';
import { MessageCircle, Check, Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import Avatar from '../components/Avatar';

const AVATAR_COLORS = [
  '#ef5350', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ff9800', '#ff5722', '#795548',
];

import { getApiUrl } from '../config';

export default function AuthScreen({ mode = 'register', onSwitchMode, onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const { joinChat } = useChat();
  const isRegister = mode === 'register';

  useEffect(() => {
    if (error) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (isRegister && (!username.trim() || username.trim().length < 2)) {
      setError('Username must be at least 2 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          username: isRegister ? username.trim() : undefined,
          color: isRegister ? selectedColor : undefined,
        }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Backend not reachable. Set VITE_API_URL in Vercel to your Railway URL.');
      }
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim() || otp.trim().length < 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Backend not reachable. Set VITE_API_URL in Vercel to your Railway URL.');
      }
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');
      joinChat(data.user.username, data.user.color);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToStep1 = () => {
    setStep(1);
    setOtp('');
    setError('');
  };

  return (
    <div className="login-screen">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className={`login-card ${shake ? 'shake' : ''}`}>
        <div className="login-logo">
          <div className="login-logo-icon">
            <MessageCircle size={38} strokeWidth={1.5} color="white" />
          </div>
          <h1 className="login-title">TatheerApp</h1>
          <p className="login-subtitle">
            {isRegister ? 'Create account with email' : 'Sign in with your email'}
          </p>
        </div>

        {step === 1 ? (
          <>
            {isRegister && (
              <div className="avatar-preview">
                <div className="avatar-preview-ring" style={{ borderColor: selectedColor + '55' }}>
                  <Avatar name={username || '?'} color={selectedColor} size="xl" />
                </div>
                <p className="avatar-preview-label">{username.trim() || 'Your display name'}</p>
              </div>
            )}

            {error && (
              <div className="login-error">
                <Mail size={14} />
                {error}
              </div>
            )}

            <form className="login-form" onSubmit={handleRequestOTP}>
              <div className="login-input-group">
                <label className="login-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  className="login-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {isRegister && (
                <>
                  <div className="login-input-group">
                    <label className="login-label" htmlFor="username">Display Name</label>
                    <input
                      id="username"
                      className="login-input"
                      type="text"
                      placeholder="Enter your name"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={20}
                      autoComplete="username"
                    />
                    <span className="char-count">{username.length}/20</span>
                  </div>
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
                        >
                          {selectedColor === color && <Check size={14} color="white" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="login-btn"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <span className="login-btn-loading">
                    <Loader2 size={16} className="spin" />
                    Sending OTP…
                  </span>
                ) : (
                  <>
                    <Mail size={16} />
                    Send OTP to Email
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="otp-sent-info">
              <Mail size={24} />
              <p>We sent a 6-digit code to</p>
              <strong>{email}</strong>
            </div>

            {error && (
              <div className="login-error">
                <Mail size={14} />
                {error}
              </div>
            )}

            <form className="login-form" onSubmit={handleVerifyOTP}>
              <div className="login-input-group">
                <label className="login-label" htmlFor="otp">Enter OTP</label>
                <input
                  id="otp"
                  className="login-input otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={loading || otp.trim().length < 6}
              >
                {loading ? (
                  <span className="login-btn-loading">
                    <Loader2 size={16} className="spin" />
                    Verifying…
                  </span>
                ) : (
                  <>
                    <Check size={16} />
                    Verify & Continue
                  </>
                )}
              </button>

              <button type="button" className="link-btn" onClick={handleBackToStep1}>
                <ArrowLeft size={14} />
                Change email
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">
          <button type="button" className="link-btn" onClick={onSwitchMode}>
            {isRegister ? 'Already have an account? Log in' : "Don't have an account? Register"}
          </button>
          {onBack && (
            <button type="button" className="link-btn" onClick={onBack}>
              Back to quick join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
