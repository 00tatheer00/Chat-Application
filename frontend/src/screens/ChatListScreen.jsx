import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquarePlus, Users, LogOut, Search,
  Wifi, Settings,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import ConversationItem from '../components/ConversationItem';
import NewChatModal from '../components/NewChatModal';
import { useChat } from '../context/ChatContext';
import { sortedRooms, getRoomDisplayName, getRoomColor, getDMPartnerId } from '../utils/helpers';

const FILTERS = ['All', 'Unread', 'Groups', 'Direct'];

export default function ChatListScreen() {
  const navigate = useNavigate();
  const {
    currentUser, rooms, onlineUsers, activeRoomId,
    unreadCounts, logout, openDM,
  } = useChat();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const filteredRooms = sortedRooms(rooms).filter((room) => {
    const name = getRoomDisplayName(room, currentUser?.id).toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filter === 'Unread') return (unreadCounts[room.id] || 0) > 0;
    if (filter === 'Groups') return room.type === 'group';
    if (filter === 'Direct') return room.type === 'direct';
    return true;
  });

  const onlineOthers = onlineUsers.filter((u) => u.id !== currentUser?.id);

  const handleRoomClick = (roomId) => {
    navigate(`/chats/${roomId}`);
  };

  return (
    <>
      <div className="chat-list-screen">
        {/* ── Header ── */}
        <header className="chat-list-header">
          <div className="chat-list-header-top">
            <div
              className="chat-list-profile"
              onClick={() => setShowProfile((p) => !p)}
            >
              <Avatar
                name={currentUser?.username}
                color={currentUser?.color}
                size="md"
                showOnline
                isOnline
              />
              <div className="chat-list-profile-info">
                <h1 className="chat-list-title">{currentUser?.username}</h1>
                <div className="chat-list-status">
                  <span className="status-dot online" />
                  Online
                </div>
              </div>
            </div>
            <div className="chat-list-header-actions">
              {totalUnread > 0 && (
                <div className="total-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</div>
              )}
              <button
                className="icon-btn tooltip"
                data-tooltip="New chat"
                onClick={() => setShowNewChat(true)}
              >
                <MessageSquarePlus size={24} />
              </button>
              <button
                className="icon-btn tooltip"
                data-tooltip="Settings"
                onClick={() => {}}
              >
                <Settings size={22} />
              </button>
              <button
                className="icon-btn tooltip"
                data-tooltip="Sign out"
                onClick={logout}
              >
                <LogOut size={22} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Search ── */}
        <div className="chat-list-search">
          <div className="search-input-wrapper search-large">
            <Search size={18} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="chat-filter-tabs chat-list-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {f === 'Unread' && totalUnread > 0 && (
                <span className="filter-badge">{totalUnread}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Online users strip ── */}
        {onlineOthers.length > 0 && filter === 'All' && !search && (
          <div className="online-users-section online-section-large">
            <div className="online-strip-label">
              <span className="notif-dot" style={{ background: '#25d366' }} />
              Online Now ({onlineOthers.length})
            </div>
            <div className="online-users-scroll">
              {onlineOthers.map((u) => (
                <div
                  key={u.id}
                  className="online-user-item online-user-large"
                  onClick={() => openDM(u.id)}
                  title={`Start chat with ${u.username}`}
                >
                  <Avatar name={u.username} color={u.color} size="md" showOnline isOnline />
                  <span className="online-user-name">{u.username.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Conversations ── */}
        <div className="chat-list-conversations">
          <div className="conversations-section-title">Recent Chats</div>
          {filteredRooms.length === 0 ? (
            <div className="empty-state empty-state-large">
              <div className="empty-state-icon">
                <MessageSquarePlus size={48} strokeWidth={1.5} />
              </div>
              <h3>No conversations yet</h3>
              <p>
                {search
                  ? 'No matching conversations. Try a different search.'
                  : 'Tap the + button to start a new chat or create a group!'}
              </p>
              {!search && (
                <button className="btn-primary start-chat-btn" onClick={() => setShowNewChat(true)}>
                  <MessageSquarePlus size={18} />
                  Start New Chat
                </button>
              )}
            </div>
          ) : (
            filteredRooms.map((room) => (
              <ConversationItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                onClick={() => handleRoomClick(room.id)}
                showChevron
              />
            ))
          )}
        </div>

        {/* ── Footer stats ── */}
        <footer className="chat-list-footer">
          <span>
            <Wifi size={14} style={{ marginRight: 6 }} />
            {onlineUsers.length} online
          </span>
          <span>
            <Users size={14} style={{ marginRight: 6 }} />
            {rooms.length} chat{rooms.length !== 1 ? 's' : ''}
          </span>
        </footer>
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </>
  );
}
