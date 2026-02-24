import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function ChatScreen() {
  return (
    <div className="chat-screen">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
