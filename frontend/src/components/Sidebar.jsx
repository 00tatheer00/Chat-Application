import { useState } from 'react';
import {
  MessageSquarePlus, Users, LogOut, Settings,
  Search, Filter, ChevronDown, Wifi,
} from 'lucide-react';
import Avatar from './Avatar';
import ConversationItem from './ConversationItem';
import NewChatModal from './NewChatModal';
import { useChat } from '../context/ChatContext';
import { sortedRooms, getRoomDisplayName, getRoomColor, getDMPartnerId } from '../utils/helpers';

const FILTERS = ['All', 'Unread', 'Groups', 'Direct'];

export default function Sidebar() {
  const {
    currentUser, rooms, onlineUsers, activeRoomId,
    setActiveRoom, logout, unreadCounts,
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

  // Online users (excluding self) for the "online now" strip
  const onlineOthers = onlineUsers.filter((u) => u.id !== currentUser?.id);

  return (
    <>
      <aside className="sidebar">
        {/* ── Header ── */}
        <header className="sidebar-header">
          <div className="sidebar-header-left" onClick={() => setShowProfile((p) => !p)} style={{ cursor: 'pointer' }}>
            <Avatar
              name={currentUser?.username}
              color={currentUser?.color}
              size="sm"
              showOnline
              isOnline
            />
            <div>
              <div className="sidebar-header-title">{currentUser?.username}</div>
              <div style={{ fontSize: 11, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wifi size={10} /> Online
              </div>
            </div>
          </div>

          <div className="sidebar-header-actions">
            {totalUnread > 0 && (
              <div className="total-unread-badge">{totalUnread > 99 ? '99+' : totalUnread}</div>
            )}
            <button
              className="icon-btn tooltip"
              data-tooltip="New chat / group"
              onClick={() => setShowNewChat(true)}
            >
              <MessageSquarePlus size={20} />
            </button>
            <button
              className="icon-btn tooltip"
              data-tooltip="Sign out"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* ── Search ── */}
        <div className="sidebar-search">
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="chat-filter-tabs">
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
          <div className="online-users-section">
            <div className="online-strip-label">
              <span className="notif-dot" style={{ background: '#25d366' }} />
              Online Now ({onlineOthers.length})
            </div>
            <div className="online-users-scroll">
              {onlineOthers.map((u) => (
                <div key={u.id} className="online-user-item" title={u.username}>
                  <Avatar name={u.username} color={u.color} size="sm" showOnline isOnline />
                  <span className="online-user-name">{u.username.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Conversations ── */}
        <div className="conversations-list">
          {filteredRooms.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 40 }}>
              <MessageSquarePlus size={36} />
              <p>
                {search ? 'No matching conversations.' : 'No chats yet.\nClick + to start chatting!'}
              </p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <ConversationItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                onClick={() => setActiveRoom(room.id)}
              />
            ))
          )}
        </div>

        {/* ── Footer stats ── */}
        <div className="sidebar-footer">
          <span>
            <Users size={13} style={{ marginRight: 4 }} />
            {onlineUsers.length} online
          </span>
          <span>
            {rooms.length} chat{rooms.length !== 1 ? 's' : ''}
          </span>
        </div>
      </aside>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </>
  );
}
