import { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

const ChatContext = createContext(null);

// ─── Initial State ─────────────────────────────────────────────────────────────
const initialState = {
  currentUser: null,
  onlineUsers: [],
  rooms: [],
  activeRoomId: null,
  messages: {},        // roomId → message[]
  typingUsers: {},     // roomId → [{ userId, username }]
  unreadCounts: {},    // roomId → number
  isConnected: false,
  isLoading: false,
  error: null,
};

// ─── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'USER_JOINED': {
      const { user, rooms, onlineUsers } = action.payload;
      const msgs = {};
      rooms.forEach((r) => { msgs[r.id] = r.messages || []; });
      return {
        ...state,
        currentUser: user,
        onlineUsers,
        rooms: rooms.map((r) => ({ ...r, messages: undefined })),
        messages: msgs,
        isConnected: true,
        isLoading: false,
        error: null,
      };
    }

    case 'USER_ONLINE':
      return { ...state, onlineUsers: action.payload.onlineUsers };

    case 'USER_OFFLINE':
      return { ...state, onlineUsers: action.payload.onlineUsers };

    case 'SET_ACTIVE_ROOM':
      return {
        ...state,
        activeRoomId: action.payload,
        unreadCounts: { ...state.unreadCounts, [action.payload]: 0 },
      };

    case 'NEW_MESSAGE': {
      const { message } = action.payload;
      const { roomId } = message;
      const prev = state.messages[roomId] || [];
      const isActive = state.activeRoomId === roomId;
      const isOwn = message.senderId === state.currentUser?.id;

      return {
        ...state,
        messages: { ...state.messages, [roomId]: [...prev, message] },
        rooms: state.rooms.map((r) =>
          r.id === roomId ? { ...r, lastMessage: message, lastActivity: new Date() } : r
        ),
        unreadCounts: {
          ...state.unreadCounts,
          [roomId]: isActive || isOwn ? 0 : (state.unreadCounts[roomId] || 0) + 1,
        },
      };
    }

    case 'MESSAGE_EDITED': {
      const { messageId, content, editedAt } = action.payload;
      const updated = {};
      Object.keys(state.messages).forEach((rid) => {
        updated[rid] = state.messages[rid].map((m) =>
          m.id === messageId ? { ...m, content, edited: true, editedAt } : m
        );
      });
      return { ...state, messages: updated };
    }

    case 'MESSAGE_DELETED': {
      const { messageId } = action.payload;
      const updated = {};
      Object.keys(state.messages).forEach((rid) => {
        updated[rid] = state.messages[rid].map((m) =>
          m.id === messageId ? { ...m, content: 'This message was deleted', deleted: true } : m
        );
      });
      return { ...state, messages: updated };
    }

    case 'MESSAGE_REACTED': {
      const { messageId, reactions } = action.payload;
      const updated = {};
      Object.keys(state.messages).forEach((rid) => {
        updated[rid] = state.messages[rid].map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        );
      });
      return { ...state, messages: updated };
    }

    case 'MESSAGE_DELIVERED': {
      const { roomId, messageId, userId } = action.payload;
      const roomMsgs = state.messages[roomId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: roomMsgs.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  deliveredTo: m.deliveredTo?.includes(userId) ? m.deliveredTo : [...(m.deliveredTo || []), userId],
                }
              : m
          ),
        },
      };
    }

    case 'MESSAGES_READ': {
      const { roomId, userId } = action.payload;
      const roomMsgs = state.messages[roomId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [roomId]: roomMsgs.map((m) => ({
            ...m,
            readBy: m.readBy?.includes(userId) ? m.readBy : [...(m.readBy || []), userId],
            deliveredTo: m.deliveredTo?.includes(userId) ? m.deliveredTo : [...(m.deliveredTo || []), userId],
          })),
        },
      };
    }

    case 'TYPING_START': {
      const { userId, username, roomId } = action.payload;
      const existing = state.typingUsers[roomId] || [];
      if (existing.some((u) => u.userId === userId)) return state;
      return {
        ...state,
        typingUsers: { ...state.typingUsers, [roomId]: [...existing, { userId, username }] },
      };
    }

    case 'TYPING_STOP': {
      const { userId, roomId } = action.payload;
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [roomId]: (state.typingUsers[roomId] || []).filter((u) => u.userId !== userId),
        },
      };
    }

    case 'ROOM_ADDED': {
      const { room, messages: roomMsgs } = action.payload;
      const exists = state.rooms.some((r) => r.id === room.id);
      return {
        ...state,
        rooms: exists
          ? state.rooms.map((r) => (r.id === room.id ? { ...room } : r))
          : [...state.rooms, room],
        messages: { ...state.messages, [room.id]: roomMsgs || [] },
        activeRoomId: action.payload.setActive ? room.id : state.activeRoomId,
      };
    }

    case 'ROOM_UPDATED':
      return {
        ...state,
        rooms: state.rooms.map((r) =>
          r.id === action.payload.roomId
            ? { ...r, lastMessage: action.payload.lastMessage, lastActivity: action.payload.lastActivity }
            : r
        ),
      };

    case 'LOGOUT':
      return { ...initialState };

    default:
      return state;
  }
}

// ─── Provider ──────────────────────────────────────────────────────────────────
export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef(null);
  const typingTimers = useRef({});
  const navigate = useNavigate();

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getSocket = useCallback(() => {
    if (socketRef.current) return socketRef.current;

    const socket = io('http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('user:joined', (data) => dispatch({ type: 'USER_JOINED', payload: data }));
    socket.on('user:online', (data) => dispatch({ type: 'USER_ONLINE', payload: data }));
    socket.on('user:offline', (data) => dispatch({ type: 'USER_OFFLINE', payload: data }));

    socket.on('message:new', (message) => {
      dispatch({ type: 'NEW_MESSAGE', payload: { message } });
      if (message.senderId !== socket.id && message.type !== 'system') {
        socket.emit('message:delivered', { roomId: message.roomId, messageId: message.id });
      }
    });
    socket.on('message:edited', (data) =>
      dispatch({ type: 'MESSAGE_EDITED', payload: data })
    );
    socket.on('message:deleted', (data) =>
      dispatch({ type: 'MESSAGE_DELETED', payload: data })
    );
    socket.on('message:reacted', (data) =>
      dispatch({ type: 'MESSAGE_REACTED', payload: data })
    );

    socket.on('typing:start', (data) => dispatch({ type: 'TYPING_START', payload: data }));
    socket.on('typing:stop', (data) => dispatch({ type: 'TYPING_STOP', payload: data }));

    socket.on('room:updated', (data) => dispatch({ type: 'ROOM_UPDATED', payload: data }));

    socket.on('message:delivered', (data) => dispatch({ type: 'MESSAGE_DELIVERED', payload: data }));
    socket.on('messages:read', (data) => dispatch({ type: 'MESSAGES_READ', payload: data }));

    socket.on('dm:created', ({ room, messages }) => {
      dispatch({ type: 'ROOM_ADDED', payload: { room, messages, setActive: true } });
      navigate(`/chats/${room.id}`);
    });
    socket.on('dm:invited', ({ room, messages }) =>
      dispatch({ type: 'ROOM_ADDED', payload: { room, messages, setActive: false } })
    );
    socket.on('room:created', ({ room }) => {
      dispatch({ type: 'ROOM_ADDED', payload: { room, messages: [], setActive: true } });
      navigate(`/chats/${room.id}`);
    });

    socket.on('error', (data) => dispatch({ type: 'SET_ERROR', payload: data.message }));

    return socket;
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const joinChat = useCallback(
    (username, color) => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      const socket = getSocket();
      socket.emit('user:join', { username, color });
    },
    [getSocket]
  );

  const sendMessage = useCallback(
    (content, replyTo = null) => {
      const socket = socketRef.current;
      if (!socket || !state.activeRoomId) return;
      socket.emit('message:send', {
        roomId: state.activeRoomId,
        content,
        replyTo,
        type: 'text',
      });
    },
    [state.activeRoomId]
  );

  const editMessage = useCallback(
    (messageId, newContent) => {
      const socket = socketRef.current;
      if (!socket || !state.activeRoomId) return;
      socket.emit('message:edit', { roomId: state.activeRoomId, messageId, newContent });
    },
    [state.activeRoomId]
  );

  const deleteMessage = useCallback(
    (messageId) => {
      const socket = socketRef.current;
      if (!socket || !state.activeRoomId) return;
      socket.emit('message:delete', { roomId: state.activeRoomId, messageId });
    },
    [state.activeRoomId]
  );

  const reactToMessage = useCallback(
    (messageId, emoji) => {
      const socket = socketRef.current;
      if (!socket || !state.activeRoomId) return;
      socket.emit('message:react', { messageId, roomId: state.activeRoomId, emoji });
    },
    [state.activeRoomId]
  );

  const startTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !state.activeRoomId) return;
    socket.emit('typing:start', { roomId: state.activeRoomId });
    clearTimeout(typingTimers.current[state.activeRoomId]);
    typingTimers.current[state.activeRoomId] = setTimeout(() => {
      socket.emit('typing:stop', { roomId: state.activeRoomId });
    }, 3000);
  }, [state.activeRoomId]);

  const stopTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !state.activeRoomId) return;
    clearTimeout(typingTimers.current[state.activeRoomId]);
    socket.emit('typing:stop', { roomId: state.activeRoomId });
  }, [state.activeRoomId]);

  const openDM = useCallback((targetUserId) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('dm:create', { targetUserId });
  }, []);

  const createGroup = useCallback((name, memberIds, icon) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('room:create', { name, memberIds, icon });
  }, []);

  const setActiveRoom = useCallback(
    (roomId) => {
      dispatch({ type: 'SET_ACTIVE_ROOM', payload: roomId });
      const socket = socketRef.current;
      if (socket) socket.emit('messages:read', { roomId });
    },
    []
  );

  const logout = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    dispatch({ type: 'LOGOUT' });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        ...state,
        joinChat,
        sendMessage,
        editMessage,
        deleteMessage,
        reactToMessage,
        startTyping,
        stopTyping,
        openDM,
        createGroup,
        setActiveRoom,
        logout,
        getSocket: () => socketRef.current,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within <ChatProvider>');
  return ctx;
}
