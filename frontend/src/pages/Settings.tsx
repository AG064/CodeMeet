import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type PrivacySettings = {
  hideAvatar: boolean;
  hideCity: boolean;
  hideLastSeen: boolean;
};

const STORAGE_KEY = 'privacySettings';

const Settings: React.FC = () => {
  const initial = useMemo<PrivacySettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { hideAvatar: false, hideCity: false, hideLastSeen: false };
      return JSON.parse(raw) as PrivacySettings;
    } catch {
      return { hideAvatar: false, hideCity: false, hideLastSeen: false };
    }
  }, []);

  const [settings, setSettings] = useState<PrivacySettings>(initial);
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof PrivacySettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">General Settings</h1>
        <p className="text-zinc-500 mt-1">Privacy and account preferences.</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-200">Privacy Controls</h2>

        {[{ key: 'hideAvatar', label: 'Hide avatar from public profile' }, { key: 'hideCity', label: 'Hide city from public profile' }, { key: 'hideLastSeen', label: 'Hide last seen status' }].map((item) => (
          <label key={item.key} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3 cursor-pointer">
            <span className="text-zinc-300 text-sm">{item.label}</span>
            <input
              type="checkbox"
              checked={settings[item.key as keyof PrivacySettings]}
              onChange={() => toggle(item.key as keyof PrivacySettings)}
              className="h-4 w-4 accent-indigo-500"
            />
          </label>
        ))}

        <div className="flex items-center justify-between pt-2">
          <Link to="/privacy" className="text-sm text-indigo-300 hover:text-indigo-200">Read Privacy statement</Link>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Save settings</button>
        </div>

        {saved && <p className="text-emerald-400 text-xs">Saved locally. For strict enforcement, mirror these settings in backend policy checks.</p>}
      </div>

      <div className="text-xs text-zinc-500">© {new Date().getFullYear()} CodeMeet. All rights reserved.</div>
    </div>
  );
};

export default Settings;
