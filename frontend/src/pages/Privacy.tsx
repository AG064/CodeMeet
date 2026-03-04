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
          CodeMeet processes account, profile, and messaging metadata required to provide core networking features.
          Authentication relies on secure JSON Web Tokens stored in the browser.
        </p>
        <p>
          Public profile views only expose public fields. Access to user data is constrained by backend authorization rules.
          Sensitive identifiers and credentials are never rendered in public profile pages.
        </p>
        <p>
          You can manage local privacy preferences in Settings. Some controls may require backend policy enforcement
          to apply globally across all clients.
        </p>
        <p className="text-zinc-500">Last updated: March 3, 2026</p>
      </div>

      <div className="text-xs text-zinc-500">© {new Date().getFullYear()} CodeMeet. All rights reserved.</div>
    </div>
  );
};

export default Privacy;
