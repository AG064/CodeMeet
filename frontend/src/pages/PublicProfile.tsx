import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { IconUser } from '../components/Icons';
import { toHandle } from '../utils/handle';

type PublicUser = {
  id: string;
  name: string;
  profilePicture?: string;
  lastSeenAt?: string | null;
};

type PublicBio = {
  primaryLanguage?: string;
  experienceLevel?: string;
  lookFor?: string;
  city?: string;
};

type PublicProfile = {
  aboutMe?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const PublicProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bio, setBio] = useState<PublicBio | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: u }, { data: b }, { data: p }] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/users/${id}/bio`).catch(() => ({ data: {} })),
          api.get(`/users/${id}/profile`).catch(() => ({ data: {} }))
        ]);

        // Keep only public fields on client rendering path.
        setUser({ id: u.id, name: u.name, profilePicture: u.profilePicture, lastSeenAt: u.lastSeenAt || null });
        setBio({
          primaryLanguage: b.primaryLanguage,
          experienceLevel: b.experienceLevel,
          lookFor: b.lookFor,
          city: b.city
        });
        setProfile({ aboutMe: p.aboutMe || '' });
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (loading) {
    return <div className="h-full flex items-center justify-center text-zinc-500">Loading profile...</div>;
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">Profile unavailable or not visible.</p>
        <button onClick={() => navigate('/chat')} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700">Back to chat</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="glass-panel p-6 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden border border-white/10 flex items-center justify-center">
            {user.profilePicture ? (
              <img src={`${BACKEND_BASE_URL}${user.profilePicture}`} className="w-full h-full object-cover" alt={user.name} />
            ) : (
              <IconUser className="w-8 h-8 text-zinc-500" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">{user.name}</h1>
            <p className="text-indigo-300 text-sm">{toHandle(user.name)}</p>
            <p className="text-zinc-500 text-xs mt-1">Last seen: {user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : 'recently'}</p>
          </div>
        </div>

        {profile?.aboutMe && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-2">About</h3>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{profile.aboutMe}</p>
          </div>
        )}
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-white/5">
        <h2 className="text-lg font-semibold text-zinc-200 mb-4">Public Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5"><span className="text-zinc-500">Primary stack:</span> <span className="text-zinc-200">{bio?.primaryLanguage || 'Not provided'}</span></div>
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5"><span className="text-zinc-500">Experience:</span> <span className="text-zinc-200">{bio?.experienceLevel || 'Not provided'}</span></div>
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5"><span className="text-zinc-500">Looking for:</span> <span className="text-zinc-200">{bio?.lookFor || 'Not provided'}</span></div>
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5"><span className="text-zinc-500">City:</span> <span className="text-zinc-200">{bio?.city || 'Not provided'}</span></div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => navigate('/chat')} className="px-4 py-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5">Back</button>
        <button onClick={() => navigate(`/chat/${user.id}`)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Message</button>
      </div>
    </div>
  );
};

export default PublicProfile;
