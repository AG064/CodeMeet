import React from 'react';
import { useNavigate } from 'react-router-dom';

const Privacy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all"
          title="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1 className="text-3xl font-bold text-zinc-100">Privacy Statement</h1>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 text-sm text-zinc-300 leading-relaxed">
        <p>
          CodeMeet stores the account details needed to run the platform, including your email address, display name,
          bio fields, your chosen city label, internal GPS coordinates, match radius, profile text, connection state, and chat messages. When you upload a
          profile picture or message attachment, the file is stored by the backend and linked to your account or conversation.
        </p>
        <p>
          Authentication is handled with a JSON Web Token stored in the browser so the frontend can call the API on your
          behalf. Public profile requests are filtered by backend authorization rules, and blocked users cannot view your
          profile or interact with you.
        </p>
        <p>
          The privacy controls in Settings are saved to your account. If you hide your avatar, age, city, match radius,
          or last-seen data, those fields are removed from public profile responses and connection presence snapshots shown to
          other signed-in users. Exact GPS coordinates are never returned from public profile endpoints, but they are still used internally for spatial proximity filtering.
        </p>
        <p>
          You can update or remove profile content at any time from the dashboard and settings screens. Background images
          and other appearance-only choices that are marked as browser-local stay in your current browser instead of being
          shared across devices.
        </p>
        <p className="text-zinc-500">Last updated: March 7, 2026</p>
      </div>

      <div className="text-xs text-zinc-500">© {new Date().getFullYear()} CodeMeet. All rights reserved.</div>
    </div>
  );
};

export default Privacy;
