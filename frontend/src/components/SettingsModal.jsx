import { useState, useEffect, useRef } from 'react';
import {
  X, User, ChevronDown, ChevronRight, Check, Bell, Palette,
  Info, LogOut, Volume2, VolumeX, Moon, Sun, Monitor, Camera,
} from 'lucide-react';
import Avatar from './Avatar';
import { useChat } from '../context/ChatContext';

const AVATAR_COLORS = [
  '#ef5350', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ff9800', '#ff5722', '#795548',
];

const SETTINGS_KEY = 'tatheer_settings';

function getStoredSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    return s ? { ...JSON.parse(s) } : {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export default function SettingsModal({ onClose }) {
  const { currentUser, updateProfile, uploadAvatar, logout, error } = useChat();
  const fileInputRef = useRef(null);
  const [expanded, setExpanded] = useState({ profile: true, account: false, notifications: false, appearance: false, about: false });
  const [profileForm, setProfileForm] = useState({
    username: currentUser?.username || '',
    color: currentUser?.color || '#00a884',
    bio: currentUser?.bio || '',
  });
  const [settings, setSettings] = useState(() => getStoredSettings());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        username: currentUser.username || '',
        color: currentUser.color || '#00a884',
        bio: currentUser.bio || '',
      });
    }
  }, [currentUser]);

  const toggleSection = (key) => {
    setExpanded((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select an image (JPEG, PNG, GIF, or WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Image must be under 2MB.');
      return;
    }
    setProfileError('');
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      uploadAvatar(reader.result);
      setUploading(false);
      fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setProfileError('Failed to read image.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = () => {
    setProfileError('');
    const trimmed = profileForm.username.trim();
    if (trimmed.length < 2) {
      setProfileError('Display name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    updateProfile({
      username: trimmed,
      color: profileForm.color,
      bio: profileForm.bio.slice(0, 150),
    });
    setTimeout(() => setSaving(false), 800);
  };

  const handleSettingChange = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  const hasProfileChanges =
    profileForm.username.trim() !== (currentUser?.username || '') ||
    profileForm.color !== (currentUser?.color || '#00a884') ||
    profileForm.bio !== (currentUser?.bio || '');

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal settings-modal">
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          {/* ── Profile ── */}
          <div className="settings-section">
            <button
              className="settings-section-header"
              onClick={() => toggleSection('profile')}
            >
              <User size={18} />
              <span>Profile</span>
              {expanded.profile ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expanded.profile && (
              <div className="settings-section-content">
                <div className="settings-detail-row">
                  <div className="avatar-preview settings-avatar">
                    <div className="avatar-preview-ring" style={{ borderColor: profileForm.color + '55' }}>
                      <Avatar
                        name={profileForm.username || '?'}
                        color={profileForm.color}
                        size="xl"
                        src={currentUser?.avatarUrl}
                      />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="avatar-upload-input"
                      onChange={handleAvatarSelect}
                    />
                    <button
                      type="button"
                      className="avatar-upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      title="Change profile photo"
                    >
                      <Camera size={20} />
                      {uploading ? 'Uploading…' : 'Change photo'}
                    </button>
                  </div>
                </div>
                <div className="settings-detail-row">
                  <label className="settings-label">Display name</label>
                  <input
                    className="settings-input"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="Your name"
                    maxLength={20}
                  />
                  <span className="char-count">{profileForm.username.length}/20</span>
                </div>
                <div className="settings-detail-row">
                  <label className="settings-label">Avatar color</label>
                  <div className="color-picker">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${profileForm.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setProfileForm((p) => ({ ...p, color }))}
                      >
                        {profileForm.color === color && <Check size={14} color="white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-detail-row">
                  <label className="settings-label">Bio</label>
                  <textarea
                    className="settings-textarea"
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                    placeholder="Tell others about yourself"
                    maxLength={150}
                    rows={2}
                  />
                  <span className="char-count">{profileForm.bio.length}/150</span>
                </div>
                {(profileError || error) && (
                  <div className="login-error settings-error">{profileError || error}</div>
                )}
                {hasProfileChanges && (
                  <button
                    className="btn-primary settings-save-btn"
                    onClick={handleProfileSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Account ── */}
          <div className="settings-section">
            <button
              className="settings-section-header"
              onClick={() => toggleSection('account')}
            >
              <User size={18} />
              <span>Account</span>
              {expanded.account ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expanded.account && (
              <div className="settings-section-content">
                <div className="settings-detail-row">
                  <span className="settings-label">Signed in as</span>
                  <span className="settings-value">{currentUser?.username || '—'}</span>
                </div>
                <button className="settings-logout-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* ── Notifications ── */}
          <div className="settings-section">
            <button
              className="settings-section-header"
              onClick={() => toggleSection('notifications')}
            >
              <Bell size={18} />
              <span>Notifications</span>
              {expanded.notifications ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expanded.notifications && (
              <div className="settings-section-content">
                <div className="settings-toggle-row">
                  <span className="settings-toggle-label">
                    {settings.sound !== false ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    Message sounds
                  </span>
                  <button
                    className={`settings-toggle ${settings.sound !== false ? 'on' : ''}`}
                    onClick={() => handleSettingChange('sound', settings.sound === false)}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </div>
                <div className="settings-toggle-row">
                  <span className="settings-toggle-label">
                    <Bell size={18} />
                    Desktop notifications
                  </span>
                  <button
                    className={`settings-toggle ${settings.desktopNotifications ? 'on' : ''}`}
                    onClick={() => handleSettingChange('desktopNotifications', !settings.desktopNotifications)}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Appearance ── */}
          <div className="settings-section">
            <button
              className="settings-section-header"
              onClick={() => toggleSection('appearance')}
            >
              <Palette size={18} />
              <span>Appearance</span>
              {expanded.appearance ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expanded.appearance && (
              <div className="settings-section-content">
                <div className="settings-detail-row">
                  <label className="settings-label">Theme</label>
                  <div className="theme-options">
                    {[
                      { id: 'dark', icon: Moon, label: 'Dark' },
                      { id: 'light', icon: Sun, label: 'Light' },
                      { id: 'system', icon: Monitor, label: 'System' },
                    ].map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        className={`theme-option ${(settings.theme || 'dark') === id ? 'active' : ''}`}
                        onClick={() => handleSettingChange('theme', id)}
                      >
                        <Icon size={18} />
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="settings-hint">Light theme coming soon. Currently dark only.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── About ── */}
          <div className="settings-section">
            <button
              className="settings-section-header"
              onClick={() => toggleSection('about')}
            >
              <Info size={18} />
              <span>About</span>
              {expanded.about ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {expanded.about && (
              <div className="settings-section-content">
                <div className="settings-detail-row">
                  <span className="settings-label">Version</span>
                  <span className="settings-value">1.0.0</span>
                </div>
                <div className="settings-detail-row">
                  <span className="settings-label">TatheerApp</span>
                  <span className="settings-value">Real-time WebSocket chat</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
