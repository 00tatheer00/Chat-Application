import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import { useCall } from '../context/CallContext';
import { useChat } from '../context/ChatContext';

export default function ActiveCallScreen() {
  const { callState, localStream, remoteStream, endCall } = useCall();
  const { onlineUsers } = useChat();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el || !localStream) return;
    el.srcObject = localStream;
    el.play().catch(() => {});
  }, [localStream]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    el.muted = false;
    el.play().catch(() => {});
  }, [remoteStream]);

  useEffect(() => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    localStream.getVideoTracks().forEach((t) => (t.enabled = !videoOff && callState?.callType === 'video'));
  }, [localStream, muted, videoOff, callState?.callType]);

  if (!callState || (callState.type !== 'active' && callState.type !== 'outgoing')) return null;

  const isOutgoing = callState.type === 'outgoing';
  const partner = callState.fromUser || onlineUsers.find((u) => u.id === callState.targetUserId);
  const isVideo = callState.callType === 'video';

  return (
    <div className="call-overlay active-call">
      <div className="call-video-container">
        <div className="call-video-remote">
          {remoteStream ? (
            <video
              key="remote-video"
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted={false}
              onLoadedMetadata={(e) => e.target.play().catch(() => {})}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="call-video-placeholder">
              <Avatar
                name={partner?.username}
                color={partner?.color}
                size="xl"
              />
              <span className="call-placeholder-name">{partner?.username}</span>
              <span className="call-placeholder-status">
                {isOutgoing ? 'Ringing…' : 'Connected'}
              </span>
            </div>
          )}
        </div>
        <div className="call-video-local">
          {localStream && isVideo ? (
            <video
              key="local-video"
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => e.target.play().catch(() => {})}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="call-video-placeholder small">
              <Avatar name="You" color="#00a884" size="md" />
            </div>
          )}
        </div>
      </div>

      <div className="call-controls">
        <button
          className={`call-control-btn ${muted ? 'active' : ''}`}
          onClick={() => setMuted((m) => !m)}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        {isVideo && (
          <button
            className={`call-control-btn ${videoOff ? 'active' : ''}`}
            onClick={() => setVideoOff((v) => !v)}
            title={videoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {videoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
        )}
        <button className="call-control-btn end" onClick={endCall} title="End call">
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
