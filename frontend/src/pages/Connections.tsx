import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { IconCheck, IconNetwork } from '../components/Icons';

const BACKEND_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

type ConnectionRequest = {
  id: string;
  connectionId: string;
  name: string;
  profilePicture?: string;
  bio?: { maxDistanceKm?: number; locationVisible?: boolean; primaryLanguage?: string };
};

type ActiveConnection = {
  id: string;
  name: string;
  profilePicture?: string;
  bio?: { maxDistanceKm?: number; locationVisible?: boolean; primaryLanguage?: string };
};

type ConnectionSummary = {
  id: string;
  connectionId: string;
};

type UserSummary = {
  name?: string;
  profilePicture?: string;
};

type PublicBio = {
  maxDistanceKm?: number;
  locationVisible?: boolean;
  primaryLanguage?: string;
};

const Connections: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted'>('accepted');
  const [pendingRequests, setPendingRequests] = useState<ConnectionRequest[]>([]);
  const [activeConnections, setActiveConnections] = useState<ActiveConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pendingRes, activeRes] = await Promise.all([
        api.get<ConnectionSummary[]>('/connections/pending'),
        api.get<ConnectionSummary[]>('/connections')
      ]);

      // The list endpoints return relationship ids first, then we hydrate each card with public user details.
      const detailedPending = await Promise.all(
        pendingRes.data.map(async (req) => {
          try {
            const userRes = await api.get<UserSummary>(`/users/${req.id}`);
            const bioRes = await api.get<PublicBio>(`/users/${req.id}/bio`).catch(() => ({ data: {} as PublicBio }));
            return {
              id: req.id,
              connectionId: req.connectionId,
              name: userRes.data?.name || 'Unknown User',
              profilePicture: userRes.data?.profilePicture,
              bio: bioRes.data
            };
          } catch {
            return { id: req.id, connectionId: req.connectionId, name: 'Unknown' };
          }
        })
      );
      setPendingRequests(detailedPending);

      const detailedActive = await Promise.all(
        activeRes.data.map(async (conn) => {
          try {
            const userRes = await api.get<UserSummary>(`/users/${conn.id}`);
            const bioRes = await api.get<PublicBio>(`/users/${conn.id}/bio`).catch(() => ({ data: {} as PublicBio }));
            return {
              id: conn.id,
              name: userRes.data?.name || 'Unknown User',
              profilePicture: userRes.data?.profilePicture,
              bio: bioRes.data
            };
          } catch {
            return { id: conn.id, name: 'Unknown' };
          }
        })
      );
      setActiveConnections(detailedActive);
      
      if (detailedPending.length > 0) {
        setActiveTab('pending');
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (req: ConnectionRequest) => {
    try {
      await api.post(`/connections/${req.connectionId}/accept`);

      // Move the accepted user from the pending list into the active network immediately.
      setPendingRequests(prev => prev.filter(p => p.connectionId !== req.connectionId));
      const newActive: ActiveConnection = {
        id: req.id,
        name: req.name,
        profilePicture: req.profilePicture,
        bio: req.bio
      };
      setActiveConnections(prev => [...prev, newActive]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (req: ConnectionRequest) => {
    try {
      await api.post(`/connections/${req.connectionId}/reject`);
      setPendingRequests(prev => prev.filter(p => p.connectionId !== req.connectionId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!window.confirm('Are you sure you want to disconnect?')) return;
    try {
      await api.delete(`/connections/disconnect/${id}`);
      setActiveConnections(prev => prev.filter(conn => conn.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMessage = (userId: string) => {
      navigate(`/chat/${userId}`);
  };

  if (loading) return (
      <div className="flex items-center justify-center h-full text-zinc-500 font-medium animate-pulse">
          SYNCING NETWORK...
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
               <h1 className="text-3xl font-bold text-zinc-100">Connections</h1>
               <p className="text-zinc-500 mt-1">Manage your network and incoming requests.</p>
            </div>
            
            <div className="bg-zinc-900/50 p-1 rounded-xl flex border border-white/5">
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'pending' 
                        ? 'bg-zinc-800 text-white shadow-lg' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    Requests
                    {pendingRequests.length > 0 && (
                        <span className="ml-2 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('accepted')}
                    className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'accepted' 
                        ? 'bg-zinc-800 text-white shadow-lg' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                >
                    My Network
                    <span className="ml-2 text-zinc-600 text-[10px]">
                        {activeConnections.length}
                    </span>
                </button>
            </div>
        </div>

        <div className="min-h-[400px]">
            {activeTab === 'pending' && (
            /* Incoming requests */
                <div className="space-y-4">
                    {pendingRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-zinc-800 rounded-2xl">
                             <div className="mb-4 opacity-50 grayscale"><IconCheck className="w-16 h-16 text-zinc-700" /></div>
                             <p className="text-zinc-500 font-medium">No pending requests</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingRequests.map(req => (
                                <div key={req.connectionId} className="glass-panel p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 relative group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            {req.profilePicture ? (
                                                <img src={`${BACKEND_BASE_URL}${req.profilePicture}`} className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/30" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                                                    {req.name.charAt(0)}
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="font-bold text-zinc-200">{req.name}</h3>
                                                <p className="text-xs text-indigo-400">Wants to connect</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {req.bio?.primaryLanguage && (
                                        <div className="mb-4 flex flex-wrap gap-2">
                                            <span className="px-2 py-1 bg-zinc-900/50 rounded text-[10px] text-zinc-400 border border-zinc-800">
                                                {req.bio.primaryLanguage}
                                            </span>
                                            {req.bio.locationVisible !== false && req.bio.maxDistanceKm != null && (
                                                <span className="px-2 py-1 bg-zinc-900/50 rounded text-[10px] text-zinc-400 border border-zinc-800">
                                                {req.bio.maxDistanceKm} km radius
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-auto">
                                        <button 
                                            onClick={() => handleReject(req)}
                                            className="flex-1 py-2 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 text-xs font-medium transition-colors"
                                        >
                                            Decline
                                        </button>
                                        <button 
                                            onClick={() => handleAccept(req)}
                                            className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 text-xs font-medium transition-colors"
                                        >
                                            Accept
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'accepted' && (
              /* Accepted connections */
                <div className="space-y-4">
                    {activeConnections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                             <div className="mb-4 opacity-50 grayscale"><IconNetwork className="w-16 h-16 text-zinc-700" /></div>
                             <h3 className="text-zinc-300 font-medium">Your network is empty</h3>
                             <p className="text-zinc-500 text-sm mt-2 mb-6">Connect with others to start building your professional circle.</p>
                             <button
                                onClick={() => navigate('/matches')}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg hover:shadow-indigo-600/20"
                             >
                                Discover Peers
                             </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeConnections.map(conn => (
                                <div key={conn.id} className="glass-panel p-5 rounded-2xl border border-white/5 hover:border-zinc-700 transition-colors group relative overflow-hidden">
                                     <div className="flex items-center gap-4 mb-4">
                                        {conn.profilePicture ? (
                                            <img src={`${BACKEND_BASE_URL}${conn.profilePicture}`} className="w-14 h-14 rounded-full object-cover bg-zinc-800" />
                                        ) : (
                                            <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xl">
                                                {conn.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-zinc-200 truncate pr-6">{conn.name}</h3>
                                            <p className="text-xs text-zinc-500 truncate flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span>
                                                Connected
                                            </p>
                                        </div>
                                     </div>

                                     <div className="border-t border-zinc-800/50 pt-4 flex gap-3">
                                         <button
                                            onClick={() => handleDisconnect(conn.id)}
                                            className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"
                                            title="Disconnect"
                                         >
                                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                             </svg>
                                         </button>
                                         <button
                                            onClick={() => handleMessage(conn.id)}
                                            className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-all border border-zinc-700 hover:border-zinc-600 flex items-center justify-center gap-2"
                                         >
                                            <span>Message</span>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                         </button>
                                     </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default Connections;