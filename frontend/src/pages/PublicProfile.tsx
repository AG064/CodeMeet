import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { IconUser } from '../components/Icons';
import { toHandle } from '../utils/handle';

type PublicUser = {
  id: string;
  name: string;
  profilePicture?: string;
  avatarVisible?: boolean;
  lastSeenAt?: string | null;
  lastSeenVisible?: boolean;
};

type PublicBio = {
  primaryLanguage?: string;
  experienceLevel?: string;
  lookFor?: string;
  maxDistanceKm?: number;
  locationVisible?: boolean;
  age?: number;
  ageVisible?: boolean;
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
  const [blocking, setBlocking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

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

        setUser({
          id: u.id,
          name: u.name,
          profilePicture: u.profilePicture,
          avatarVisible: u.avatarVisible !== false,
          lastSeenAt: u.lastSeenAt || null,
          lastSeenVisible: u.lastSeenVisible !== false,
        });
        setBio({
          primaryLanguage: b.primaryLanguage,
          experienceLevel: b.experienceLevel,
          lookFor: b.lookFor,
          maxDistanceKm: b.maxDistanceKm,
          locationVisible: b.locationVisible !== false,
          age: b.age,
          ageVisible: b.ageVisible !== false,
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

  const handleBlock = async () => {
    if (!user || blocking) return;

    try {
      setBlocking(true);
      setActionError(null);
      setActionSuccess(null);
      await api.post(`/block/${user.id}`);
      window.dispatchEvent(new CustomEvent('codemeet:user-blocked', {
        detail: { id: user.id, name: user.name }
      }));
      setActionSuccess(`${user.name} was blocked successfully.`);
    } catch (error) {
      console.error('Failed to block user:', error);
      setActionError('Could not block this user right now.');
    } finally {
      setBlocking(false);
    }
  };

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
            <p className="text-zinc-500 text-xs mt-1">
              {user.lastSeenVisible === false
                ? 'Last seen hidden by this user'
                : `Last seen: ${user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString() : 'recently'}`}
            </p>
            {user.avatarVisible === false && (
              <p className="text-zinc-500 text-xs mt-1">Avatar hidden by this user</p>
            )}
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
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5"><span className="text-zinc-500">Age:</span> <span className="text-zinc-200">{bio?.ageVisible === false ? 'Hidden by user' : (bio?.age != null ? bio.age : 'Not provided')}</span></div>
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5"><span className="text-zinc-500">Match radius:</span> <span className="text-zinc-200">{bio?.locationVisible === false ? 'Hidden by user' : (bio?.maxDistanceKm != null ? `${bio.maxDistanceKm} km` : 'Not provided')}</span></div>
        </div>
      </div>

      {actionError && (
        <FeedbackBanner variant="error">
          {actionError}
        </FeedbackBanner>
      )}

      {actionSuccess && (
        <FeedbackBanner variant="success">
          {actionSuccess}
        </FeedbackBanner>
      )}

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => navigate('/chat')} className="px-4 py-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5">Back</button>
        {!actionSuccess && (
          <button onClick={() => navigate(`/chat/${user.id}`)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">Message</button>
        )}
        <button
          onClick={handleBlock}
          disabled={blocking || Boolean(actionSuccess)}
          className="px-4 py-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-white disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {blocking ? 'Blocking…' : actionSuccess ? 'Blocked' : 'Block user'}
        </button>
        {actionSuccess && (
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
          >
            Manage block list
          </button>
        )}
      </div>
    </div>
  );
};

export default PublicProfile;
