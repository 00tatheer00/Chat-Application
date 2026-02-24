import { ChevronRight } from 'lucide-react';
import Avatar from './Avatar';
import { formatSidebarTime, truncate, getRoomDisplayName, getRoomColor, getDMPartnerId } from '../utils/helpers';
import { useChat } from '../context/ChatContext';

export default function ConversationItem({ room, isActive, onClick, showChevron = false }) {
  const { currentUser, onlineUsers, unreadCounts, typingUsers, messages } = useChat();

  const displayName = getRoomDisplayName(room, currentUser?.id);
  const color = getRoomColor(room, currentUser?.id);
  const unread = unreadCounts[room.id] || 0;
  const roomMessages = messages[room.id] || [];
  const lastMsg = room.lastMessage;
  const typing = typingUsers[room.id] || [];

  const isTyping = typing.length > 0;

  // Online status for DMs
  const partnerId = getDMPartnerId(room, currentUser?.id);
  const partnerOnline = partnerId
    ? onlineUsers.some((u) => u.id === partnerId)
    : false;

  const lastMsgPreview = () => {
    if (!lastMsg) return 'No messages yet';
    if (lastMsg.deleted) return '🚫 Message deleted';
    if (lastMsg.type === 'system') return lastMsg.content;
    if (lastMsg.senderId === currentUser?.id) return `You: ${truncate(lastMsg.content, 30)}`;
    return truncate(lastMsg.content, 35);
  };

  return (
    <div
      className={`conversation-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        {room.type === 'group' ? (
          <div className="group-avatar-sm">
            <span>{room.icon || '👥'}</span>
          </div>
        ) : (
          <Avatar
            name={displayName}
            color={color}
            size="md"
            showOnline={room.type === 'direct'}
            isOnline={partnerOnline}
            src={room.type === 'direct' ? onlineUsers.find((u) => u.id === partnerId)?.avatarUrl : null}
          />
        )}
      </div>

      {/* Details */}
      <div className="conv-details">
        <div className="conv-top">
          <span className="conv-name">{displayName}</span>
          <span className={`conv-time ${unread > 0 ? 'unread' : ''}`}>
            {lastMsg ? formatSidebarTime(lastMsg.createdAt) : ''}
          </span>
        </div>
        <div className="conv-bottom">
          {isTyping ? (
            <span className="conv-preview typing">
              <span className="typing-dots-small">
                <span /><span /><span />
              </span>
              {typing.length === 1
                ? `${typing[0].username} is typing`
                : `${typing.length} people typing`}
            </span>
          ) : (
            <span className="conv-preview">{lastMsgPreview()}</span>
          )}
          {unread > 0 && (
            <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>
          )}
          {showChevron && (
            <ChevronRight size={18} className="conv-chevron" />
          )}
        </div>
      </div>
    </div>
  );
}
