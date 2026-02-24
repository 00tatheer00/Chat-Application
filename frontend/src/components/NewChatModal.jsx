import { useState } from 'react';
import { X, Check, Users, MessageCircle, Search } from 'lucide-react';
import Avatar from './Avatar';
import { useChat } from '../context/ChatContext';

export default function NewChatModal({ onClose }) {
  const { onlineUsers, currentUser, openDM, createGroup } = useChat();
  const [tab, setTab] = useState('direct'); // 'direct' | 'group'
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupIcon, setGroupIcon] = useState('👥');

  const others = onlineUsers.filter((u) => u.id !== currentUser?.id);
  const filtered = others.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (user) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleDM = (userId) => {
    openDM(userId);
    onClose();
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    createGroup(groupName.trim(), selectedUsers.map((u) => u.id), groupIcon);
    onClose();
  };

  const GROUP_ICONS = ['👥', '🎮', '💼', '🎓', '🏠', '🎵', '🍕', '⚽', '📚', '✈️'];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {tab === 'direct' ? 'New Chat' : 'New Group'}
          </h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === 'direct' ? 'active' : ''}`}
            onClick={() => setTab('direct')}
          >
            <MessageCircle size={14} style={{ marginRight: 6 }} />
            Direct Message
          </button>
          <button
            className={`modal-tab ${tab === 'group' ? 'active' : ''}`}
            onClick={() => setTab('group')}
          >
            <Users size={14} style={{ marginRight: 6 }} />
            Create Group
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              className="search-input"
              style={{ borderRadius: 10, padding: '9px 12px 9px 36px' }}
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Group name + icon row */}
        {tab === 'group' && (
          <div style={{ padding: '0 16px 8px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              {/* Icon picker */}
              <div style={{ position: 'relative' }}>
                <select
                  className="group-icon-select"
                  value={groupIcon}
                  onChange={(e) => setGroupIcon(e.target.value)}
                  style={{
                    background: 'var(--bg-medium)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    color: 'var(--text-primary)',
                    fontSize: 22,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {GROUP_ICONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </div>
              <input
                className="group-name-input"
                style={{ flex: 1, margin: 0 }}
                placeholder="Group name…"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>

            {/* Selected users chips */}
            {selectedUsers.length > 0 && (
              <div className="selected-users-preview">
                {selectedUsers.map((u) => (
                  <div key={u.id} className="selected-user-chip">
                    <Avatar name={u.username} color={u.color} size="xs" src={u.avatarUrl} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{u.username}</span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}
                      onClick={() => toggleSelect(u)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User list */}
        <div className="modal-body">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Users size={32} />
              <p>{others.length === 0 ? 'No other users online yet.' : 'No users match your search.'}</p>
            </div>
          ) : (
            filtered.map((user) => {
              const isSelected = selectedUsers.some((u) => u.id === user.id);
              return (
                <div
                  key={user.id}
                  className={`user-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() =>
                    tab === 'direct' ? handleDM(user.id) : toggleSelect(user)
                  }
                >
                  <Avatar name={user.username} color={user.color} size="sm" showOnline isOnline src={user.avatarUrl} />
                  <div className="user-item-info">
                    <div className="user-item-name">{user.username}</div>
                    <div className="user-item-status">● Online</div>
                  </div>
                  {tab === 'group' && (
                    <div className={`check-icon ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Check size={12} color="white" />}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer for group */}
        {tab === 'group' && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0}
            >
              Create Group ({selectedUsers.length} member{selectedUsers.length !== 1 ? 's' : ''})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
