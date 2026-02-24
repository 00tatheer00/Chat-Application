import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, Video, MoreVertical, Smile, Paperclip,
  Mic, Send, X, Users, MessageCircle, ArrowDown,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import MessageBubble from '../components/MessageBubble';
import EmojiPicker from '../components/EmojiPicker';
import { useChat } from '../context/ChatContext';
import { useCall } from '../context/CallContext';
import {
  groupMessages, formatLastSeen, getRoomDisplayName,
  getRoomColor, getDMPartnerId,
} from '../utils/helpers';

function TypingIndicator({ typers }) {
  if (typers.length === 0) return null;
  const label =
    typers.length === 1
      ? `${typers[0].username} is typing`
      : `${typers.map((t) => t.username).join(', ')} are typing`;

  return (
    <div className="typing-indicator">
      <div className="typing-bubble">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
      <span className="typing-label">{label}</span>
    </div>
  );
}

export default function ChatConversationScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const {
    currentUser, rooms, messages, typingUsers,
    onlineUsers, sendMessage, startTyping, stopTyping,
    setActiveRoom,
  } = useChat();
  const { startCall } = useCall();

  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const activeRoom = rooms.find((r) => r.id === roomId);
  const roomMessages = (roomId ? messages[roomId] : []) || [];
  const typers = (roomId ? typingUsers[roomId] : []) || [];
  const grouped = groupMessages(roomMessages);

  // Set active room when entering
  useEffect(() => {
    if (roomId) setActiveRoom(roomId);
  }, [roomId, setActiveRoom]);

  const displayName = activeRoom ? getRoomDisplayName(activeRoom, currentUser?.id) : '';
  const color = activeRoom ? getRoomColor(activeRoom, currentUser?.id) : '#00a884';
  const partnerId = activeRoom ? getDMPartnerId(activeRoom, currentUser?.id) : null;
  const partnerUser = partnerId ? onlineUsers.find((u) => u.id === partnerId) : null;
  const isPartnerOnline = !!partnerUser;
  const statusText =
    activeRoom?.type === 'group'
      ? `${activeRoom.members?.length || 0} members`
      : isPartnerOnline
      ? 'Online'
      : formatLastSeen(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [roomId]);

  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    const isNearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 200;
    if (isNearBottom) scrollToBottom();
  }, [roomMessages.length, scrollToBottom]);

  const handleScroll = () => {
    const area = messagesAreaRef.current;
    if (!area) return;
    const far = area.scrollHeight - area.scrollTop - area.clientHeight > 400;
    setShowScrollBtn(far);
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 1500);
    }
  };

  const handleInput = (e) => {
    setInputText(e.target.value);
    clearTimeout(typingTimerRef.current);
    startTyping();
    typingTimerRef.current = setTimeout(stopTyping, 2500);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    sendMessage(text, replyTo?.id || null);
    setInputText('');
    setReplyTo(null);
    stopTyping();
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setReplyTo(null);
      setShowEmoji(false);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInputText((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleBack = () => {
    navigate('/chats');
  };

  // Room not found - redirect to list
  if (!roomId || !activeRoom) {
    navigate('/chats', { replace: true });
    return null;
  }

  return (
    <div className="chat-conversation-screen">
      {/* ── Chat Header ── */}
      <header className="chat-header chat-conversation-header">
        <div className="chat-header-left">
          <button
            className="icon-btn back-btn"
            onClick={handleBack}
            aria-label="Back to chats"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="chat-header-info">
            {activeRoom.type === 'group' ? (
              <div className="group-avatar-md">
                <span>{activeRoom.icon || '👥'}</span>
              </div>
            ) : (
              <Avatar
                name={displayName}
                color={color}
                size="sm"
                showOnline={activeRoom.type === 'direct'}
                isOnline={isPartnerOnline}
              />
            )}
            <div className="chat-header-text">
              <div className="chat-header-name">{displayName}</div>
              <div className={`chat-header-status ${isPartnerOnline || activeRoom.type === 'group' ? 'online' : ''}`}>
                {typers.length > 0
                  ? `${typers.map((t) => t.username).join(', ')} ${typers.length === 1 ? 'is' : 'are'} typing…`
                  : statusText}
              </div>
            </div>
          </div>
        </div>
        <div className="chat-header-actions">
          {activeRoom.type === 'direct' && partnerId && (
            <>
              <button
                className="icon-btn tooltip"
                data-tooltip="Voice call"
                onClick={() => startCall(partnerId, 'voice')}
              >
                <Phone size={20} />
              </button>
              <button
                className="icon-btn tooltip"
                data-tooltip="Video call"
                onClick={() => startCall(partnerId, 'video')}
              >
                <Video size={20} />
              </button>
            </>
          )}
          {activeRoom.type === 'group' && (
            <button className="icon-btn tooltip" data-tooltip="Group members">
              <Users size={20} />
            </button>
          )}
          <button className="icon-btn tooltip" data-tooltip="More options">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* ── Messages ── */}
      <div
        className="messages-area messages-area-full"
        ref={messagesAreaRef}
        onScroll={handleScroll}
      >
        {grouped.length === 0 ? (
          <div className="no-messages">
            <MessageCircle size={48} strokeWidth={1} />
            <p>No messages yet. Say hello! 👋</p>
            <span className="no-messages-hint">Messages are end-to-end encrypted</span>
          </div>
        ) : (
          grouped.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="date-separator">
                  <span className="date-separator-text">{item.date}</span>
                </div>
              );
            }
            return (
              <div key={item.message.id} id={`msg-${item.message.id}`}>
                <MessageBubble
                  message={item.message}
                  isGrouped={item.isGrouped}
                  messages={roomMessages}
                  onReply={(msg) => { setReplyTo(msg); inputRef.current?.focus(); }}
                  onScrollTo={scrollToMessage}
                />
              </div>
            );
          })
        )}

        <TypingIndicator typers={typers.filter((t) => t.userId !== currentUser?.id)} />
        <div ref={messagesEndRef} />
      </div>

      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={() => scrollToBottom()}>
          <ArrowDown size={18} />
        </button>
      )}

      {replyTo && (
        <div className="reply-bar">
          <div className="reply-bar-accent" />
          <div className="reply-bar-content">
            <div className="reply-bar-name">{replyTo.senderName}</div>
            <div className="reply-bar-text">
              {replyTo.deleted ? '🚫 Deleted message' : replyTo.content}
            </div>
          </div>
          <button className="icon-btn" onClick={() => setReplyTo(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {showEmoji && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmoji(false)}
        />
      )}

      <div className="message-input-area">
        <button
          className={`icon-btn ${showEmoji ? 'active' : ''}`}
          onClick={() => setShowEmoji((p) => !p)}
          title="Emoji"
        >
          <Smile size={22} />
        </button>
        <button className="icon-btn" title="Attach file">
          <Paperclip size={20} />
        </button>
        <div className="message-input-wrapper">
          <textarea
            ref={inputRef}
            className="message-textarea"
            placeholder="Type a message…"
            value={inputText}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>
        {inputText.trim() ? (
          <button className="send-btn" onClick={handleSend} title="Send">
            <Send size={20} />
          </button>
        ) : (
          <button className="send-btn mic" title="Voice message">
            <Mic size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
