import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { IconBug, IconGitea, IconUser } from '../components/Icons';

type PrivacySettings = {
  hideAvatar: boolean;
  hideLocation: boolean;
  hideAge: boolean;
  hideLastSeen: boolean;
};

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  hideAvatar: false,
  hideLocation: false,
  hideAge: false,
  hideLastSeen: false,
};

const STORAGE_KEY = 'privacySettings';
const FONT_KEY = 'fontPreference';
const THEME_KEY = 'themePreference';
const BG_KEY = 'bgPreference';
const CUSTOM_THEME_KEY = 'customThemeColors';
const GITEA_URL = import.meta.env.VITE_GITEA_URL || 'https://gitea.example.com/your-org/codemeet';
const BUG_REPORT_URL = import.meta.env.VITE_BUG_REPORT_URL || `${GITEA_URL.replace(/\/$/, '')}/issues/new`;

const FONT_PRESETS = [
  { label: 'Inter', value: '"Inter"', description: 'Clean humanist sans-serif (default)' },
  { label: 'Monaspace Neon', value: '"Monaspace Neon"', description: 'Neo-grotesque mono — GitHub' },
  { label: 'Monaspace Argon', value: '"Monaspace Argon"', description: 'Humanist mono — GitHub' },
  { label: 'Monaspace Xenon', value: '"Monaspace Xenon"', description: 'Slab serif mono — GitHub' },
  { label: 'Monaspace Radon', value: '"Monaspace Radon"', description: 'Handwriting mono — GitHub' },
  { label: 'Monaspace Krypton', value: '"Monaspace Krypton"', description: 'Mechanical mono — GitHub' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono"', description: 'Developer favourite from JetBrains' },
  { label: 'Fira Code', value: '"Fira Code"', description: 'Mozilla\'s coding font with ligatures' },
  { label: 'System UI', value: 'system-ui', description: 'Your OS default font' },
];

const THEME_PRESETS = [
  { label: 'Default', value: 'default', description: 'Dark zinc with indigo accents', colors: ['#09090b', '#18181b', '#6366f1'] },
  { label: 'GitHub Dark', value: 'github-dark', description: 'Blue-tinged grays, blue accent', colors: ['#0d1117', '#161b22', '#58a6ff'] },
  { label: 'VS Code Dark+', value: 'vscode', description: 'Warm neutrals, classic editor blue', colors: ['#1e1e1e', '#252526', '#007acc'] },
  { label: 'Dracula', value: 'dracula', description: 'Purple-tinted palette, purple accent', colors: ['#282a36', '#44475a', '#bd93f9'] },
  { label: 'Custom', value: 'custom', description: 'Pick your own 3 colours below', colors: [] },
];

const BG_PRESETS = [
  { label: 'Dot Matrix', value: 'dots', description: 'Subtle dot grid (default)', preview: 'radial-gradient(circle, currentColor 1px, transparent 1px)', size: '12px 12px' },
  { label: 'Grid Lines', value: 'grid', description: 'Classic editor grid', preview: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', size: '20px 20px' },
  { label: 'Crosshatch', value: 'cross', description: 'Dense crosshatch pattern', preview: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', size: '10px 10px' },
  { label: 'Gradient Mesh', value: 'mesh', description: 'Ambient colour blobs', preview: 'radial-gradient(circle at 30% 40%, #6366f140, transparent 60%)', size: '100% 100%' },
  { label: 'Aurora', value: 'aurora', description: 'Drifting colour gradient', preview: 'linear-gradient(-45deg, #312e81, #09090b, #4338ca, #09090b)', size: '100% 100%', animated: true },
  { label: 'Pulse', value: 'pulse', description: 'Breathing radial glow', preview: 'radial-gradient(circle at 30% 40%, #6366f140, transparent 60%)', size: '100% 100%', animated: true },
  { label: 'Matrix Rain', value: 'matrix', description: 'Scrolling grid lines', preview: 'linear-gradient(0deg, transparent 48%, #6366f130 50%, transparent 52%), linear-gradient(90deg, transparent 48%, #312e8120 50%, transparent 52%)', size: '20px 20px', animated: true },
  { label: 'Starfield', value: 'starfield', description: 'Twinkling stars', preview: 'radial-gradient(1px 1px at 25% 30%, white, transparent), radial-gradient(1px 1px at 65% 70%, white, transparent), radial-gradient(1px 1px at 50% 20%, white, transparent)', size: '80px 80px', animated: true },
  { label: 'Waves', value: 'waves', description: 'Drifting diagonal lines', preview: 'repeating-linear-gradient(135deg, transparent, transparent 8px, #312e81 8px, #312e81 9px)', size: '100% 100%', animated: true },
  { label: 'None', value: 'none', description: 'Clean solid background', preview: 'none', size: '0' },
];

type CustomColors = { bg: string; surface: string; accent: string };
const DEFAULT_CUSTOM: CustomColors = { bg: '#0f0f23', surface: '#1a1a3e', accent: '#00d4ff' };

type FeedbackState = {
  variant: 'success' | 'error';
  message: string;
};

function hexToHSL(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function adjustL(hex: string, delta: number): string {
  const [h, s, l] = hexToHSL(hex);
  return hslToHex(h, s, Math.max(0, Math.min(100, l + delta)));
}

function readLocalPrivacySettings(): PrivacySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRIVACY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PrivacySettings> & { hideCity?: boolean };
    return {
      ...DEFAULT_PRIVACY_SETTINGS,
      ...parsed,
      hideLocation: parsed.hideLocation ?? parsed.hideCity ?? false,
    };
  } catch {
    return DEFAULT_PRIVACY_SETTINGS;
  }
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [loadingPrivacy, setLoadingPrivacy] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [selectedFont, setSelectedFont] = useState(() => localStorage.getItem(FONT_KEY) || '"Inter"');
  const [selectedTheme, setSelectedTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'default');

  const [bgPref, setBgPref] = useState<string | { type: string; url: string }>(() => {
    try { return JSON.parse(localStorage.getItem(BG_KEY) || '"dots"'); } catch { return 'dots'; }
  });
  const bgFileRef = useRef<HTMLInputElement>(null);

  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; name: string }>>([]);

  const [customColors, setCustomColors] = useState<CustomColors>(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_THEME_KEY) || 'null') || DEFAULT_CUSTOM; } catch { return DEFAULT_CUSTOM; }
  });

  const toggle = (key: keyof PrivacySettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setFeedback(null);
  };

  const applyFont = (fontValue: string) => {
    setSelectedFont(fontValue);
    document.documentElement.style.setProperty('--app-font', fontValue);
    localStorage.setItem(FONT_KEY, fontValue);
    setFeedback(null);
  };

  const clearCustomColors = () => {
    const s = document.documentElement.style;
    [
      '--custom-bg', '--custom-surface', '--custom-accent',
      '--color-zinc-950', '--color-zinc-900', '--color-zinc-800', '--color-zinc-700',
      '--color-zinc-600', '--color-zinc-500', '--color-zinc-400', '--color-zinc-300',
      '--color-zinc-200', '--color-zinc-100', '--color-zinc-50',
      '--color-indigo-300', '--color-indigo-400', '--color-indigo-500',
      '--color-indigo-600', '--color-indigo-700', '--color-indigo-900',
    ].forEach((p) => s.removeProperty(p));
  };

  const applyTheme = (theme: string) => {
    setSelectedTheme(theme);
    if (theme !== 'custom') clearCustomColors();
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else if (theme === 'custom') {
      document.documentElement.setAttribute('data-theme', 'custom');
      applyCustomColors(customColors);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem(THEME_KEY, theme);
    setFeedback(null);
  };

  const applyCustomColors = useCallback((c: CustomColors) => {
    const root = document.documentElement;
    root.style.setProperty('--custom-bg', c.bg);
    root.style.setProperty('--custom-surface', c.surface);
    root.style.setProperty('--custom-accent', c.accent);
    root.style.setProperty('--color-zinc-950', c.bg);
    root.style.setProperty('--color-zinc-900', c.surface);
    root.style.setProperty('--color-zinc-800', adjustL(c.surface, 5));
    root.style.setProperty('--color-zinc-700', adjustL(c.surface, 12));
    root.style.setProperty('--color-zinc-600', adjustL(c.surface, 20));
    root.style.setProperty('--color-zinc-500', adjustL(c.surface, 30));
    root.style.setProperty('--color-zinc-400', adjustL(c.surface, 42));
    root.style.setProperty('--color-zinc-300', adjustL(c.surface, 55));
    root.style.setProperty('--color-zinc-200', adjustL(c.surface, 68));
    root.style.setProperty('--color-zinc-100', adjustL(c.surface, 78));
    root.style.setProperty('--color-zinc-50', adjustL(c.surface, 88));
    root.style.setProperty('--color-indigo-300', adjustL(c.accent, 20));
    root.style.setProperty('--color-indigo-400', adjustL(c.accent, 10));
    root.style.setProperty('--color-indigo-500', c.accent);
    root.style.setProperty('--color-indigo-600', c.accent);
    root.style.setProperty('--color-indigo-700', adjustL(c.accent, -12));
    root.style.setProperty('--color-indigo-900', adjustL(c.accent, -25));
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(c));
  }, []);

  useEffect(() => {
    if (selectedTheme === 'custom') {
      document.documentElement.setAttribute('data-theme', 'custom');
      applyCustomColors(customColors);
    }
  }, [applyCustomColors, customColors, selectedTheme]);

  useEffect(() => {
    let cancelled = false;

    const loadPrivacySettings = async () => {
      setLoadingPrivacy(true);
      const fallback = readLocalPrivacySettings();

      try {
        const { data } = await api.get('/me/privacy');
        if (cancelled) return;

        const next = {
          hideAvatar: Boolean(data?.hideAvatar),
          hideLocation: Boolean(data?.hideLocation),
          hideAge: Boolean(data?.hideAge),
          hideLastSeen: Boolean(data?.hideLastSeen),
        };

        setSettings(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        if (cancelled) return;
        setSettings(fallback);
      } finally {
        if (!cancelled) {
          setLoadingPrivacy(false);
        }
      }
    };

    loadPrivacySettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        const { data } = await api.get('/block');
        setBlockedUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load blocked users:', error);
        setFeedback({ variant: 'error', message: 'Could not load your block list right now.' });
      }
    };

    loadBlockedUsers();
  }, []);

  useEffect(() => {
    const handleBlocked = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string; name: string }>;
      const blockedUser = customEvent.detail;
      if (!blockedUser?.id) return;

      setBlockedUsers((prev) => {
        if (prev.some((user) => user.id === blockedUser.id)) {
          return prev;
        }
        return [...prev, { id: blockedUser.id, name: blockedUser.name || `User-${blockedUser.id.slice(0, 8)}` }];
      });
      setFeedback({ variant: 'success', message: `${blockedUser.name || 'User'} was added to your block list.` });
    };

    const handleUnblocked = (event: Event) => {
      const customEvent = event as CustomEvent<{ id: string; name?: string }>;
      const unblockedUser = customEvent.detail;
      if (!unblockedUser?.id) return;

      setBlockedUsers((prev) => prev.filter((user) => user.id !== unblockedUser.id));
      setFeedback({ variant: 'success', message: `${unblockedUser.name || 'User'} was removed from your block list.` });
    };

    window.addEventListener('codemeet:user-blocked', handleBlocked as EventListener);
    window.addEventListener('codemeet:user-unblocked', handleUnblocked as EventListener);

    return () => {
      window.removeEventListener('codemeet:user-blocked', handleBlocked as EventListener);
      window.removeEventListener('codemeet:user-unblocked', handleUnblocked as EventListener);
    };
  }, []);

  const handleCustomColorChange = (key: keyof CustomColors, value: string) => {
    const next = { ...customColors, [key]: value };
    setCustomColors(next);
    if (selectedTheme === 'custom') applyCustomColors(next);
    setFeedback(null);
  };

  const applyBg = (val: string | { type: string; url: string }) => {
    setBgPref(val);
    localStorage.setItem(BG_KEY, JSON.stringify(val));
    setFeedback(null);
    window.dispatchEvent(new Event('bg-changed'));
  };

  const handleBgImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      applyBg({ type: 'image', url: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const savePrivacySettings = async () => {
    try {
      setSavingPrivacy(true);
      await api.post('/me/privacy', settings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      localStorage.setItem(FONT_KEY, selectedFont);
      localStorage.setItem(THEME_KEY, selectedTheme);
      localStorage.setItem(BG_KEY, JSON.stringify(bgPref));
      if (selectedTheme === 'custom') localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(customColors));
      setFeedback({ variant: 'success', message: 'Privacy settings saved successfully.' });
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      setFeedback({ variant: 'error', message: 'Could not save your privacy settings right now.' });
    } finally {
      setSavingPrivacy(false);
    }
  };

  async function handleUnblock(id: string): Promise<void> {
    try {
      const userToUnblock = blockedUsers.find((user) => user.id === id);
      await api.delete(`/block/${id}`);
      setBlockedUsers((prev) => prev.filter((user) => user.id !== id));
      setFeedback({ variant: 'success', message: `${userToUnblock?.name || 'User'} was unblocked successfully.` });
      window.dispatchEvent(new CustomEvent('codemeet:user-unblocked', {
        detail: { id, name: userToUnblock?.name }
      }));
    } catch (error) {
      console.error('Failed to unblock user:', error);
      setFeedback({ variant: 'error', message: 'Could not unblock this user right now.' });
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">General Settings</h1>
        <p className="text-zinc-500 mt-1">Appearance and privacy preferences.</p>
      </div>

      {feedback && <FeedbackBanner variant={feedback.variant}>{feedback.message}</FeedbackBanner>}

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Font</h2>
        <p className="text-zinc-500 text-sm">Choose a typeface for the interface. Includes GitHub's Monaspace family.</p>

        <div className="grid gap-2">
          {FONT_PRESETS.map((font) => (
            <button
              key={font.value}
              onClick={() => applyFont(font.value)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                selectedFont === font.value
                  ? 'border-indigo-500/40 bg-indigo-600/10 shadow-sm'
                  : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
              }`}
            >
              <div>
                <span className="text-zinc-200 text-sm font-medium" style={{ fontFamily: `${font.value}, monospace` }}>
                  {font.label}
                </span>
                <p className="text-zinc-500 text-xs mt-0.5">{font.description}</p>
              </div>
              {selectedFont === font.value && (
                <span className="text-indigo-400 text-xs font-bold">Active</span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500 mb-1">Preview</p>
          <p className="text-zinc-200 text-sm" style={{ fontFamily: `${selectedFont}, sans-serif` }}>
            The quick brown fox jumps over the lazy dog. 0123456789
          </p>
          <p className="text-zinc-400 text-xs mt-1" style={{ fontFamily: `${selectedFont}, sans-serif` }}>
            {'{ code: true, bugs: false } => deploy()'}
          </p>
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Theme</h2>
        <p className="text-zinc-500 text-sm">Switch between developer-friendly colour palettes. Applied instantly.</p>

        <div className="grid gap-2">
          {THEME_PRESETS.map((theme) => (
            <button
              key={theme.value}
              onClick={() => applyTheme(theme.value)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                selectedTheme === theme.value
                  ? 'border-indigo-500/40 bg-indigo-600/10 shadow-sm'
                  : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
              }`}
            >
              <div className="flex items-center gap-3">
                {theme.colors.length > 0 ? (
                  <div className="flex -space-x-1">
                    {theme.colors.map((c, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border-2 border-zinc-950/80"
                        style={{ backgroundColor: c, zIndex: 3 - i }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20a1 1 0 0 1-.437-.1C11.214 19.73 3 15.671 3 9a5 5 0 0 1 8.535-3.536l.465.465.465-.465A5 5 0 0 1 21 9c0 2.187-.584 4.043-1.61 5.612"/><path d="m17 15 4 4m0-4-4 4"/></svg>
                  </div>
                )}
                <div>
                  <span className="text-zinc-200 text-sm font-medium">{theme.label}</span>
                  <p className="text-zinc-500 text-xs mt-0.5">{theme.description}</p>
                </div>
              </div>
              {selectedTheme === theme.value && (
                <span className="text-indigo-400 text-xs font-bold">Active</span>
              )}
            </button>
          ))}
        </div>

        {selectedTheme === 'custom' && (
          <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-4 space-y-3">
            <p className="text-xs text-zinc-500">Pick 3 colours. The rest of the palette is derived automatically.</p>
            {([
              { key: 'bg' as const, label: 'Background', desc: 'Main page background' },
              { key: 'surface' as const, label: 'Surface', desc: 'Panels, sidebar, cards' },
              { key: 'accent' as const, label: 'Accent', desc: 'Buttons, links, highlights' },
            ]).map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={customColors[item.key]}
                  onChange={(e) => handleCustomColorChange(item.key, e.target.value)}
                  className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer bg-transparent p-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium">{item.label}</p>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
                <input
                  type="text"
                  value={customColors[item.key]}
                  onChange={(e) => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) handleCustomColorChange(item.key, e.target.value); }}
                  className="w-20 text-xs font-mono bg-zinc-800/50 border border-white/5 rounded-lg px-2 py-1.5 text-zinc-300 text-center"
                  maxLength={7}
                />
              </div>
            ))}
            <div className="flex gap-1 pt-1">
              <div className="flex-1 h-6 rounded-l-lg" style={{ backgroundColor: customColors.bg }} />
              <div className="flex-1 h-6" style={{ backgroundColor: customColors.surface }} />
              <div className="flex-1 h-6 rounded-r-lg" style={{ backgroundColor: customColors.accent }} />
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Background Pattern</h2>
        <p className="text-zinc-500 text-sm">Choose a content-area background pattern, or upload your own image.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BG_PRESETS.map((bg) => {
            const isActive = typeof bgPref === 'string' && bgPref === bg.value;
            return (
              <button
                key={bg.value}
                onClick={() => applyBg(bg.value)}
                className={`rounded-xl border px-3 py-3 text-left transition-all ${
                  isActive
                    ? 'border-indigo-500/40 bg-indigo-600/10 shadow-sm'
                    : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
                }`}
              >
                <div className="w-full h-10 rounded-lg bg-zinc-800/60 mb-2 overflow-hidden relative border border-white/5">
                  {bg.preview !== 'none' && (
                    <div
                      className="absolute inset-0 opacity-30 text-zinc-300"
                      style={{ backgroundImage: bg.preview, backgroundSize: bg.size }}
                    />
                  )}
                </div>
                <span className="text-zinc-200 text-xs font-medium block">
                  {bg.label}
                  {'animated' in bg && bg.animated && <span className="ml-1 text-indigo-400 text-[9px]">✦</span>}
                </span>
                <p className="text-zinc-500 text-[10px] mt-0.5">{bg.description}</p>
              </button>
            );
          })}

          <button
            onClick={() => bgFileRef.current?.click()}
            className={`rounded-xl border px-3 py-3 text-left transition-all ${
              typeof bgPref === 'object'
                ? 'border-indigo-500/40 bg-indigo-600/10 shadow-sm'
                : 'border-white/5 bg-zinc-900/40 hover:border-white/10 hover:bg-zinc-800/40'
            }`}
          >
            <div className="w-full h-10 rounded-lg bg-zinc-800/60 mb-2 overflow-hidden relative border border-dashed border-zinc-600 flex items-center justify-center">
              {typeof bgPref === 'object' ? (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{ backgroundImage: `url(${bgPref.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              )}
            </div>
            <span className="text-zinc-200 text-xs font-medium block">Custom Image</span>
            <p className="text-zinc-500 text-[10px] mt-0.5">Upload your own</p>
          </button>
          <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgImage} />
        </div>

        {typeof bgPref === 'object' && (
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-2">
            <span className="text-xs text-zinc-400">Custom image active</span>
            <button onClick={() => applyBg('dots')} className="text-xs text-red-400 hover:text-red-300">Remove</button>
          </div>
        )}

        <p className="text-[10px] text-zinc-600">Recommended: 1920×1080 or larger, JPEG/PNG/WebP, under 2 MB for best performance. Image is stored in your browser only.</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Privacy Controls</h2>
        <p className="text-zinc-500 text-sm">
          These controls are saved to your account and applied when other signed-in users open your profile or presence details.
        </p>

        {[
          { key: 'hideAvatar', label: 'Hide avatar from public profile' },
          { key: 'hideLocation', label: 'Hide GPS match radius from public profile' },
          { key: 'hideAge', label: 'Hide age from public profile' },
          { key: 'hideLastSeen', label: 'Hide last seen status' },
        ].map((item) => (
          <label key={item.key} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3 cursor-pointer">
            <span className="text-zinc-300 text-sm">{item.label}</span>
            <input
              type="checkbox"
              checked={settings[item.key as keyof PrivacySettings]}
              onChange={() => toggle(item.key as keyof PrivacySettings)}
              disabled={loadingPrivacy}
              className="h-4 w-4 accent-indigo-500"
            />
          </label>
        ))}

        <div className="flex items-center justify-between pt-2">
          <Link to="/privacy" className="text-sm text-indigo-300 hover:text-indigo-200">Read Privacy statement</Link>
          <button
            onClick={savePrivacySettings}
            disabled={loadingPrivacy || savingPrivacy}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingPrivacy ? 'Loading…' : savingPrivacy ? 'Saving…' : 'Save privacy settings'}
          </button>
        </div>

      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Blocked Users</h2>
        <p className="text-zinc-500 text-sm">Manage your block list. Blocked users cannot see your profile or interact with you.</p>
        {blockedUsers.length === 0 ? (
          <p className="text-zinc-400 text-sm">You have not blocked any users.</p>
        ) : (
          <div className="space-y-3">
            {blockedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-700/50 flex items-center justify-center">
                    <IconUser className="w-4 h-4 text-zinc-500" />
                  </div>
                  <span className="text-zinc-300 text-sm">{user.name}</span>
                </div>
                <button onClick={() => handleUnblock(user.id)} className="text-sm text-red-400 hover:text-red-300">Unblock</button>
              </div>
            ))}
          </div>
        )}


      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Support & Source</h2>
        <p className="text-zinc-500 text-sm">Need to flag a bug or jump into the repo? These links open in a new tab.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={BUG_REPORT_URL}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-4 transition-all hover:border-red-500/20 hover:bg-red-500/5"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300">
                <IconBug className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-red-200">Report a bug</h3>
                <p className="mt-1 text-xs text-zinc-500">Open the issue tracker and log what went sideways.</p>
              </div>
            </div>
          </a>

          <a
            href={GITEA_URL}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-4 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/5"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-300">
                <IconGitea className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-200">Open Gitea</h3>
                <p className="mt-1 text-xs text-zinc-500">Browse source, branches, and issues from the repo home.</p>
              </div>
            </div>
          </a>
        </div>
      </div>

      <div className="text-xs text-zinc-500">&copy; {new Date().getFullYear()} CodeMeet. All rights reserved.</div>
    </div>
  );
};

export default Settings;
