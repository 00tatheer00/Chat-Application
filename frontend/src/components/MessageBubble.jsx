import { useState, useRef } from 'react';
import { Check, CheckCheck, MoreVertical, Reply, Pencil, Trash2, Copy } from 'lucide-react';
import { formatTime } from '../utils/helpers';
import { QuickReactionPicker } from './EmojiPicker';
import { useChat } from '../context/ChatContext';

function MessageStatus({ message, currentUserId }) {
  if (message.senderId !== currentUserId) return null;
  if (message.type === 'system') return null;
  const readBy = message.readBy || [];
  const deliveredTo = message.deliveredTo || [];
  const readByOthers = readBy.some((id) => id !== currentUserId);
  const deliveredToOthers = deliveredTo.some((id) => id !== currentUserId);
  const isRead = readByOthers;
  const isDelivered = deliveredToOthers || readByOthers;
  const title = isRead ? 'Read' : isDelivered ? 'Delivered' : 'Sent';
  return (
    <span className={`message-status ${isRead ? 'read' : ''} ${isDelivered ? 'delivered' : ''}`} title={title}>
      {isDelivered ? <CheckCheck size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={2.5} />}
    </span>
  );
}

function ReplyQuote({ replyTo, messages, onClick }) {
  if (!replyTo) return null;
  const original = messages?.find((m) => m.id === replyTo);
  if (!original) return null;

  return (
    <div className="message-reply-quote" onClick={onClick}>
      <div className="reply-quote-name">{original.senderName}</div>
      <div className="reply-quote-content">
        {original.deleted ? '🚫 Deleted message' : original.content}
      </div>
    </div>
  );
}

function Reactions({ reactions, onReact, currentUserId }) {
  if (!reactions || Object.keys(reactions).length === 0) return null;
  return (
    <div className="message-reactions">
      {Object.entries(reactions).map(([emoji, userIds]) => (
        <button
          key={emoji}
          className={`reaction-pill ${userIds.includes(currentUserId) ? 'reacted' : ''}`}
          onClick={() => onReact(emoji)}
          title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
        >
          {emoji}
          <span className="reaction-count">{userIds.length}</span>
        </button>
      ))}
    </div>
  );
}

export default function MessageBubble({ message, isGrouped, messages, onReply, onScrollTo }) {
  const { currentUser, reactToMessage, deleteMessage, editMessage } = useChat();
  const [showActions, setShowActions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const menuRef = useRef(null);
  const editRef = useRef(null);

  const isSent = message.senderId === currentUser?.id;
  const isSystem = message.type === 'system';
  const isDeleted = message.deleted;

  if (isSystem) {
    return (
      <div className="system-message">
        <span>{message.content}</span>
      </div>
    );
  }

  const handleEditSubmit = () => {
    if (editText.trim() && editText.trim() !== message.content) {
      editMessage(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  return (
    <div
      className={`message-wrapper ${isSent ? 'sent' : 'received'} ${isGrouped ? 'grouped' : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); if (!showMenu) setShowMenu(false); }}
    >
      {/* Quick reaction picker */}
      {showActions && !isDeleted && (
        <QuickReactionPicker
          onSelect={(e) => reactToMessage(message.id, e)}
          align={isSent ? 'right' : 'left'}
        />
      )}

      {/* Bubble */}
      <div className={`message-bubble ${isSent ? 'sent' : 'received'}`}>
        {/* Sender name (in groups, for received msgs) */}
        {!isSent && !isGrouped && (
          <div className="message-sender-name" style={{ color: message.senderColor }}>
            {message.senderName}
          </div>
        )}

        {/* Reply quote */}
        {message.replyTo && !isDeleted && (
          <ReplyQuote
            replyTo={message.replyTo}
            messages={messages}
            onClick={() => onScrollTo && onScrollTo(message.replyTo)}
          />
        )}

        {/* Content */}
        {isEditing ? (
          <div className="edit-input-wrap">
            <textarea
              ref={editRef}
              className="edit-textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSubmit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
              rows={1}
            />
            <div className="edit-actions">
              <button className="edit-cancel" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="edit-save" onClick={handleEditSubmit}>Save</button>
            </div>
          </div>
        ) : (
          <div className={`message-content ${isDeleted ? 'deleted' : ''}`}>
            {isDeleted ? '🚫 This message was deleted' : message.content}
            {message.edited && !isDeleted && (
              <span className="edited-label"> (edited)</span>
            )}
          </div>
        )}

        {/* Footer: time + status */}
        {!isEditing && (
          <div className="message-footer">
            <span className="message-time">{formatTime(message.createdAt)}</span>
            <MessageStatus message={message} currentUserId={currentUser?.id} />
          </div>
        )}

        {/* Reactions */}
        <Reactions
          reactions={message.reactions}
          onReact={(e) => reactToMessage(message.id, e)}
          currentUserId={currentUser?.id}
        />
      </div>

      {/* Context menu button */}
      {showActions && (
        <div className="message-ctx-btn" ref={menuRef}>
          <button
            className="msg-action-btn"
            onClick={() => setShowMenu((p) => !p)}
            title="More options"
          >
            <MoreVertical size={14} />
          </button>
          <button
            className="msg-action-btn"
            onClick={() => { onReply(message); setShowMenu(false); }}
            title="Reply"
          >
            <Reply size={14} />
          </button>
        </div>
      )}

      {/* Dropdown menu */}
      {showMenu && (
        <div className={`msg-dropdown ${isSent ? 'sent' : 'received'}`}>
          <button onClick={() => { onReply(message); setShowMenu(false); }}>
            <Reply size={14} /> Reply
          </button>
          <button onClick={handleCopy}>
            <Copy size={14} /> Copy
          </button>
          {isSent && !isDeleted && (
            <button onClick={() => { setIsEditing(true); setEditText(message.content); setShowMenu(false); }}>
              <Pencil size={14} /> Edit
            </button>
          )}
          {isSent && !isDeleted && (
            <button className="danger" onClick={() => { deleteMessage(message.id); setShowMenu(false); }}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
