import { getInitials } from '../utils/helpers';
import { getApiUrl } from '../config';

export default function Avatar({ name, color, size = 'md', showOnline = false, isOnline = false, src }) {
  const sizes = {
    xs: { wh: 28, fs: 11 },
    sm: { wh: 36, fs: 14 },
    md: { wh: 46, fs: 18 },
    lg: { wh: 56, fs: 22 },
    xl: { wh: 72, fs: 28 },
  };
  const { wh, fs } = sizes[size] || sizes.md;

  const imageUrl = src?.startsWith('/') ? `${getApiUrl()}${src}` : src;

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: wh, height: wh }}>
      <div
        style={{
          width: wh,
          height: wh,
          borderRadius: '50%',
          backgroundColor: color || '#00a884',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fs,
          fontWeight: 700,
          color: '#fff',
          userSelect: 'none',
          letterSpacing: '0.5px',
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name || 'Avatar'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          getInitials(name)
        )}
      </div>
      {showOnline && (
        <div
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: wh * 0.27,
            height: wh * 0.27,
            borderRadius: '50%',
            backgroundColor: isOnline ? '#25d366' : '#8696a0',
            border: '2px solid var(--bg-dark)',
          }}
        />
      )}
    </div>
  );
}
