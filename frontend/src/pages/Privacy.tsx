import React from 'react';

const Privacy: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold text-zinc-100">Privacy Statement</h1>

      <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4 text-sm text-zinc-300 leading-relaxed">
        <p>
          CodeMeet processes account, profile, and messaging metadata required to provide core networking features.
          Authentication and session controls rely on secure tokens and essential cookies.
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
