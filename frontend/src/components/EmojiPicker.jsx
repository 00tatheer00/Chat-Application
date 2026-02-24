import { useState, useEffect, useRef } from 'react';

const EMOJI_CATEGORIES = {
  '😀': {
    label: 'Smileys',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
      '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
      '🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫',
      '🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬',
      '😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵',
      '🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
      '😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦',
      '😧','😨','😰','😥','😢','😭','😱','😖','😣','😞',
    ],
  },
  '👋': {
    label: 'Gestures',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞',
      '🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍',
      '👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝',
      '🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂',
    ],
  },
  '❤️': {
    label: 'Hearts',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
      '❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
      '💟','☮️','✝️','☪️','🕉️','✡️','🔯','🕎','☯️','🛐',
    ],
  },
  '🐶': {
    label: 'Animals',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨',
      '🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔',
      '🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴',
      '🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟',
    ],
  },
  '🍕': {
    label: 'Food',
    emojis: [
      '🍕','🍔','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲',
      '🫕','🥗','🥪','🍱','🍣','🍜','🍝','🍛','🍚','🍙',
      '🍘','🍥','🥮','🍡','🧁','🎂','🍰','🍮','🍭','🍬',
      '🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋',
    ],
  },
  '⚽': {
    label: 'Activities',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱',
      '🏓','🏸','🏒','🥊','🥋','🎽','🛹','🛼','🛷','⛸️',
      '🏋️','🤸','⛹️','🤺','🤾','🏌️','🏇','🧘','🏄','🏊',
      '🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️',
    ],
  },
  '🚀': {
    label: 'Travel',
    emojis: [
      '🚀','✈️','🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑',
      '🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵','🛺','🚲',
      '🛴','🛹','🛼','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢',
      '🛸','🚁','🚟','🚃','🚋','🚝','🚄','🚅','🚈','🚂',
    ],
  },
  '💡': {
    label: 'Objects',
    emojis: [
      '💡','🔦','🕯️','🪔','🧲','🔋','🪫','💻','🖥️','🖨️',
      '⌨️','🖱️','🖲️','💾','💿','📀','📱','☎️','📞','📟',
      '📠','📺','📻','🧭','⏱️','⏰','⌚','📡','🔭','🔬',
      '💊','🩺','🩹','🩻','🩼','🦯','🦽','🦼','🧸','🪆',
    ],
  },
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function QuickReactionPicker({ onSelect, align = 'left' }) {
  return (
    <div
      className="quick-reaction-picker"
      style={{ [align === 'right' ? 'right' : 'left']: 0 }}
    >
      {QUICK_REACTIONS.map((e) => (
        <button key={e} className="reaction-emoji-btn" onClick={() => onSelect(e)} title={e}>
          {e}
        </button>
      ))}
    </div>
  );
}

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('😀');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filteredEmojis = search
    ? Object.values(EMOJI_CATEGORIES)
        .flatMap((c) => c.emojis)
        .filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory]?.emojis || [];

  return (
    <div className="emoji-picker" ref={ref}>
      <div className="emoji-picker-header">
        <input
          className="emoji-search"
          placeholder="Search emoji…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {!search && (
        <div className="emoji-categories">
          {Object.keys(EMOJI_CATEGORIES).map((cat) => (
            <button
              key={cat}
              className={`emoji-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              title={EMOJI_CATEGORIES[cat].label}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {!search && (
        <div style={{ padding: '6px 12px 2px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          {EMOJI_CATEGORIES[activeCategory]?.label}
        </div>
      )}

      <div className="emoji-grid">
        {filteredEmojis.map((emoji, i) => (
          <button key={`${emoji}-${i}`} className="emoji-btn" onClick={() => onSelect(emoji)} title={emoji}>
            {emoji}
          </button>
        ))}
        {filteredEmojis.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No emoji found
          </div>
        )}
      </div>
    </div>
  );
}
