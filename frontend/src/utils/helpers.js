// ─── Time Formatting ───────────────────────────────────────────────────────────
export function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function formatSidebarTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);

  if (diffDays === 0) return formatTime(date);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)
    return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatLastSeen(date) {
  if (!date) return 'last seen recently';
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return 'last seen just now';
  if (diff < 3600) return `last seen ${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `last seen ${Math.floor(diff / 3600)}h ago`;
  return `last seen ${Math.floor(diff / 86400)}d ago`;
}

// ─── Text Helpers ──────────────────────────────────────────────────────────────
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function truncate(str, len = 45) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// ─── Message Grouping ──────────────────────────────────────────────────────────
export function groupMessages(messages) {
  const groups = [];
  let lastDate = null;
  let lastSenderId = null;
  let lastTime = null;

  messages.forEach((msg, i) => {
    const msgDate = formatDate(msg.createdAt);

    if (msgDate !== lastDate) {
      groups.push({ type: 'date', id: `date-${i}`, date: msgDate });
      lastDate = msgDate;
      lastSenderId = null;
      lastTime = null;
    }

    const msgTime = new Date(msg.createdAt).getTime();
    const timeDiff = lastTime ? (msgTime - lastTime) / 1000 / 60 : Infinity;
    const isGrouped =
      lastSenderId === msg.senderId && timeDiff < 5 && msg.type !== 'system';

    groups.push({ type: 'message', message: msg, isGrouped });
    lastSenderId = msg.senderId;
    lastTime = msgTime;
  });

  return groups;
}

// ─── Room Helpers ──────────────────────────────────────────────────────────────
export function getRoomDisplayName(room, currentUserId) {
  if (room.type === 'direct' && room.memberNames) {
    const otherId = Object.keys(room.memberNames).find((id) => id !== currentUserId);
    return room.memberNames[otherId] || room.name;
  }
  return room.name;
}

export function getRoomColor(room, currentUserId) {
  if (room.type === 'direct' && room.memberColors) {
    const otherId = Object.keys(room.memberColors).find((id) => id !== currentUserId);
    return room.memberColors[otherId];
  }
  return '#128c7e';
}

export function getDMPartnerId(room, currentUserId) {
  if (room.type !== 'direct') return null;
  return room.members?.find((id) => id !== currentUserId) || null;
}

// ─── Color Utilities ───────────────────────────────────────────────────────────
export function lightenColor(hex, amount = 0.3) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ─── Sort Rooms ────────────────────────────────────────────────────────────────
export function sortedRooms(rooms) {
  return [...rooms].sort((a, b) => {
    const ta = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const tb = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return tb - ta;
  });
}
