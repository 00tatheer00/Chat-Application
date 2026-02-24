import { useState } from 'react';
import { MessageCircle, Mail, User, Zap } from 'lucide-react';
import AuthScreen from './AuthScreen';
import LoginScreen from './LoginScreen';

export default function LandingScreen() {
  const [view, setView] = useState('choice'); // 'choice' | 'register' | 'login' | 'quick'

  if (view === 'register' || view === 'login') {
    return (
      <AuthScreen
        mode={view}
        onSwitchMode={() => setView((v) => (v === 'register' ? 'login' : 'register'))}
        onBack={() => setView('choice')}
      />
    );
  }

  if (view === 'quick') {
    return <LoginScreen onBack={() => setView('choice')} />;
  }

  return (
    <div className="login-screen">
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className="login-card landing-choice">
        <div className="login-logo">
          <div className="login-logo-icon">
            <MessageCircle size={38} strokeWidth={1.5} color="white" />
          </div>
          <h1 className="login-title">TatheerApp</h1>
          <p className="login-subtitle">Real-time chat with email verification</p>
        </div>

        <div className="landing-options">
          <button
            className="landing-option-btn primary"
            onClick={() => setView('register')}
          >
            <Mail size={24} />
            <span>Register with Email</span>
            <span className="landing-option-desc">Create account • OTP verification</span>
          </button>

          <button
            className="landing-option-btn"
            onClick={() => setView('login')}
          >
            <User size={24} />
            <span>Log in with Email</span>
            <span className="landing-option-desc">Already have an account</span>
          </button>

          <button
            className="landing-option-btn secondary"
            onClick={() => setView('quick')}
          >
            <Zap size={24} />
            <span>Quick Join</span>
            <span className="landing-option-desc">No account needed (dev mode)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
