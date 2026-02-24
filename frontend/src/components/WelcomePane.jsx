import { MessageCircle } from 'lucide-react';

export default function WelcomePane() {
  return (
    <div className="chat-window-empty welcome-pane-full">
      <div className="chat-window-empty-icon">
        <MessageCircle size={56} strokeWidth={1} />
      </div>
      <h2>TatheerApp</h2>
      <p>Select a conversation from the list or start a new chat to begin messaging.</p>
      <div className="welcome-features">
        {[
          'Real-time WebSocket messaging',
          'Direct messages & group chats',
          'Message reactions & replies',
          'Typing indicators',
          'Read receipts',
        ].map((f) => (
          <div key={f} className="welcome-feature">
            <span className="welcome-feature-dot" />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}
