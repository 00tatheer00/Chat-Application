import { Routes, Route, Navigate } from 'react-router-dom';
import { ChatProvider, useChat } from './context/ChatContext';
import { CallProvider } from './context/CallContext';
import LandingScreen from './screens/LandingScreen';
import ChatLayout from './components/ChatLayout';
import ChatListScreen from './screens/ChatListScreen';
import ChatConversationScreen from './screens/ChatConversationScreen';
import WelcomePane from './components/WelcomePane';
import IncomingCallModal from './components/IncomingCallModal';
import ActiveCallScreen from './components/ActiveCallScreen';

function AppContent() {
  const { isConnected } = useChat();

  if (!isConnected) {
    return <LandingScreen />;
  }

  return (
    <CallProvider>
      <IncomingCallModal />
      <ActiveCallScreen />
      <Routes>
      <Route path="/" element={<Navigate to="/chats" replace />} />
      <Route path="/chats" element={<ChatLayout />}>
        <Route index element={<WelcomePane />} />
        <Route path=":roomId" element={<ChatConversationScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/chats" replace />} />
    </Routes>
    </CallProvider>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <AppContent />
    </ChatProvider>
  );
}
