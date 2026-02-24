import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useChat } from './ChatContext';

const CallContext = createContext(null);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

export function CallProvider({ children }) {
  const { getSocket, currentUser, isConnected } = useChat();
  const [callState, setCallState] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const pendingOfferRef = useRef(null);

  const cleanup = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setLocalStream((ls) => {
      if (ls) ls.getTracks().forEach((t) => t.stop());
      return null;
    });
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
    pendingOfferRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    const socket = getSocket();
    const state = callState;
    if (state?.targetUserId && socket) {
      socket.emit('call:end', { targetUserId: state.targetUserId });
    }
    if (state?.fromUserId && socket) {
      socket.emit('call:end', { targetUserId: state.fromUserId });
    }
    cleanup();
    setCallState(null);
  }, [callState, getSocket, cleanup]);

  const rejectCall = useCallback(() => {
    const socket = getSocket();
    const state = callState;
    if (state?.fromUserId && socket) {
      socket.emit('call:reject', { fromUserId: state.fromUserId });
    }
    cleanup();
    setCallState(null);
  }, [callState, getSocket, cleanup]);

  const startCall = useCallback(
    async (targetUserId, type = 'video') => {
      const socket = getSocket();
      if (!socket || !currentUser) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true,
        });
        setLocalStream(stream);
        const pc = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-compat',
        });
        peerRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit('call:ice-candidate', { targetUserId, candidate: e.candidate });
        };
        pc.ontrack = (e) => setRemoteStream(e.streams[0]);
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') endCall();
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:start', { targetUserId, type });
        socket.emit('call:offer', { targetUserId, offer });
        setCallState({ type: 'outgoing', targetUserId, callType: type });
      } catch (err) {
        console.error('Failed to start call:', err);
        setCallState(null);
      }
    },
    [getSocket, currentUser, endCall]
  );

  const acceptCall = useCallback(
    async () => {
      const socket = getSocket();
      const state = callState;
      const { fromUserId, fromUser, type } = state || {};
      if (!socket || !fromUserId) return;
      const pending = pendingOfferRef.current;
      const offer = pending?.fromUserId === fromUserId ? pending.offer : null;
      if (!offer) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true,
        });
        setLocalStream(stream);
        const pc = new RTCPeerConnection({
          iceServers: ICE_SERVERS,
          iceCandidatePoolSize: 10,
          bundlePolicy: 'max-compat',
        });
        peerRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit('call:ice-candidate', { targetUserId: fromUserId, candidate: e.candidate });
        };
        pc.ontrack = (e) => setRemoteStream(e.streams[0]);
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') endCall();
        };
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        pendingCandidatesRef.current.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
        pendingCandidatesRef.current = [];
        pendingOfferRef.current = null;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:answer', { targetUserId: fromUserId, answer });
        setCallState({ type: 'active', fromUserId, fromUser, callType: type });
      } catch (err) {
        console.error('Failed to accept call:', err);
        rejectCall();
      }
    },
    [callState, getSocket, endCall, rejectCall]
  );

  useEffect(() => {
    if (!isConnected) return;
    const socket = getSocket();
    if (!socket) return;

    const handleIncoming = ({ fromUserId, fromUser, type }) => {
      pendingOfferRef.current = null;
      pendingCandidatesRef.current = [];
      setCallState({ type: 'incoming', fromUserId, fromUser, callType: type || 'video' });
    };

    const handleOffer = ({ fromUserId, offer }) => {
      pendingOfferRef.current = { fromUserId, offer };
    };

    const handleAnswer = async ({ fromUserId, answer }) => {
      const pc = peerRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          setCallState((s) => (s ? { ...s, type: 'active' } : null));
        } catch (e) {
          console.error('Answer setRemoteDescription failed:', e);
        }
      }
    };

    const handleIceCandidate = ({ fromUserId, candidate }) => {
      const pc = peerRef.current;
      if (pc?.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handleRejected = () => {
      cleanup();
      setCallState(null);
    };

    const handleEnded = () => {
      cleanup();
      setCallState(null);
    };

    socket.on('call:incoming', handleIncoming);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:rejected', handleRejected);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:incoming', handleIncoming);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:rejected', handleRejected);
      socket.off('call:ended', handleEnded);
    };
  }, [getSocket, cleanup, isConnected]);

  return (
    <CallContext.Provider
      value={{
        callState,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
