import { Outlet, useLocation } from 'react-router-dom';
import ChatListScreen from '../screens/ChatListScreen';

export default function ChatLayout() {
  const { pathname } = useLocation();
  const isConversation = pathname.match(/\/chats\/([^/]+)/);

  return (
    <div className="chat-app-layout">
      {/* Left: Chat list - sidebar on desktop, full screen on mobile when not in conversation */}
      <aside className={`chat-list-panel ${isConversation ? 'mobile-hidden' : ''}`}>
        <ChatListScreen />
      </aside>
      {/* Right: Conversation or welcome - on desktop always; on mobile only when in conversation */}
      <main className={`chat-main-panel ${!isConversation ? 'mobile-hidden' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}
