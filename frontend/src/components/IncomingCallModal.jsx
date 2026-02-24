import { Phone, PhoneOff } from 'lucide-react';
import Avatar from './Avatar';
import { useCall } from '../context/CallContext';

export default function IncomingCallModal() {
  const { callState, acceptCall, rejectCall } = useCall();

  if (!callState || callState.type !== 'incoming') return null;

  const { fromUser, callType } = callState;
  const isVideo = callType === 'video';

  return (
    <div className="call-overlay incoming-call">
      <div className="call-modal">
        <div className="call-modal-avatar">
          <Avatar name={fromUser?.username} color={fromUser?.color} size="xl" />
        </div>
        <h2 className="call-modal-name">{fromUser?.username}</h2>
        <p className="call-modal-type">{isVideo ? 'Video call' : 'Voice call'}</p>
        <div className="call-modal-actions">
          <button className="call-btn accept" onClick={acceptCall} title="Accept">
            <Phone size={28} />
          </button>
          <button className="call-btn reject" onClick={rejectCall} title="Decline">
            <PhoneOff size={28} />
          </button>
        </div>
      </div>
    </div>
  );
}
