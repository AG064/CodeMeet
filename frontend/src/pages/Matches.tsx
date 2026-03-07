import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { IconUser, IconSearch } from '../components/Icons';

const BACKEND_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

type Candidate = {
    id: string;
    name: string;
    profilePicture?: string;
    bio?: {
        primaryLanguage?: string;
        experienceLevel?: string;
        maxDistanceKm?: number;
        locationVisible?: boolean;
        lookFor?: string;
        age?: number;
        ageVisible?: boolean;
    };
    matchScore?: number;
};

const Matches: React.FC = () => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    useEffect(() => {
        fetchRecommendations();
    }, []);

    useEffect(() => {
        const handleBlocked = (event: Event) => {
            const customEvent = event as CustomEvent<{ id: string }>;
            const blockedId = customEvent.detail?.id;
            if (!blockedId) return;
            setCandidates((prev) => prev.filter((candidate) => candidate.id !== blockedId));
        };

        window.addEventListener('codemeet:user-blocked', handleBlocked as EventListener);
        return () => window.removeEventListener('codemeet:user-blocked', handleBlocked as EventListener);
    }, []);

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const { data: recs } = await api.get('/recommendations');
            
            if (!recs || recs.length === 0) {
                setCandidates([]);
                setLoading(false);
                return;
            }

            // Each recommendation starts as just an id, so we load the public user card and bio in parallel.
            const detailedCandidates: Candidate[] = await Promise.all(
                recs.map(async (rec: { id: string }) => {
                    try {
                        const [userRes, bioRes] = await Promise.all([
                            api.get(`/users/${rec.id}`),
                            api.get(`/users/${rec.id}/bio`).catch(() => ({ data: {} }))
                        ]);

                        return {
                            id: rec.id,
                            name: userRes?.data?.name || 'Unknown User',
                            profilePicture: userRes?.data?.profilePicture || null,
                            bio: {
                                primaryLanguage: bioRes.data?.primaryLanguage || 'N/A',
                                experienceLevel: bioRes.data?.experienceLevel || 'Undisclosed',
                                maxDistanceKm: bioRes.data?.maxDistanceKm,
                                locationVisible: bioRes.data?.locationVisible !== false,
                                age: bioRes.data?.age,
                                ageVisible: bioRes.data?.ageVisible !== false,
                            }
                        };
                    } catch {
                        return { id: rec.id, name: 'Error', bio: {} } as Candidate;
                    }
                })
            );

            setCandidates(detailedCandidates);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (userId: string) => {
        try {
            setActionError(null);
            setActionSuccess(null);
            await api.post(`/connections/request/${userId}`);
            setCandidates(prev => prev.filter(c => c.id !== userId));
        } catch (err) {
            console.error(err);
            setActionError('Could not send the connection request.');
        }
    };

    const handleDismiss = async (userId: string) => {
        try {
            setActionError(null);
            setActionSuccess(null);
            await api.post(`/recommendations/skip/${userId}`);
            setCandidates(prev => prev.filter(c => c.id !== userId));
        } catch (err) {
            console.error("Failed to skip user:", err);
            setActionError('Could not skip this user right now.');
        }
    };

    const handleBlock = async (candidate: Candidate) => {
        try {
            setActionError(null);
            await api.post(`/block/${candidate.id}`);
            setCandidates((prev) => prev.filter((item) => item.id !== candidate.id));
            setActionSuccess(`${candidate.name} was blocked successfully.`);
            window.dispatchEvent(new CustomEvent('codemeet:user-blocked', {
                detail: { id: candidate.id, name: candidate.name }
            }));
        } catch (err) {
            console.error('Failed to block user:', err);
            setActionError('Could not block this user right now.');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full text-zinc-500 font-medium animate-pulse">
            SEARCHING NETWORK...
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in relative">
            <div className="flex justify-between items-end">
                <div>
                   <h1 className="text-3xl font-bold text-zinc-100">Discovery</h1>
                   <p className="text-zinc-500 mt-1">AI-driven connections based on your profile.</p>
                </div>
                <div className="text-zinc-500 text-sm font-mono">
                   {candidates.length} CANDIDATES FOUND
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

            {candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center bg-zinc-900/30 border border-white/5 border-dashed rounded-3xl p-12 text-center h-96">
                    <div className="flex items-center justify-center mb-4 opacity-30 grayscale"><IconSearch className="w-12 h-12 text-zinc-700" /></div>
                    <h3 className="text-xl font-medium text-zinc-300">No new recommendations</h3>
                    <p className="text-zinc-500 mt-2 max-w-md mx-auto">
                        We've run out of matches for now. Try updating your bio to cast a wider net.
                    </p>
                    <button onClick={fetchRecommendations} className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Refresh</button>
                </div>
            ) : (
                /* Recommendation cards */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {candidates.map((rec) => (
                        <div key={rec.id} className="cyber-card group flex flex-col relative overflow-hidden h-[28rem]">
                            <div className="h-1/2 bg-zinc-900 relative overflow-hidden">
                                {rec.profilePicture ? (
                                    <img src={`${BACKEND_BASE_URL}${rec.profilePicture}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={rec.name} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-700 bg-zinc-800">
                                        <div className="w-20 h-20 rounded-full bg-zinc-700/50 flex items-center justify-center"><IconUser className="w-10 h-10 text-zinc-500" /></div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80"></div>
                            </div>
                            
                            <div className="p-6 -mt-12 relative z-10 flex-1 flex flex-col">
                                <h3 className="text-xl font-bold text-zinc-100 mb-0.5">{rec.name}</h3>
                                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-4">
                                    <span>{rec.bio?.ageVisible === false ? 'Age hidden' : (rec.bio?.age != null ? `${rec.bio.age} yrs` : 'Age hidden')}</span>
                                    <span>•</span>
                                    <span className="truncate max-w-[140px]">{rec.bio?.locationVisible === false ? 'Radius hidden' : (rec.bio?.maxDistanceKm != null ? `${rec.bio.maxDistanceKm} km radius` : 'Radius unavailable')}</span>
                                    <span>•</span>
                                    <span className="text-indigo-400 font-mono">ID: {rec.id.split('-')[0]}</span>
                                </div>
                                
                                <div className="flex-1 space-y-2 mb-4">
                                    <div className="bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Primary Stack</div>
                                        <div className="text-zinc-300 text-sm font-medium">{rec.bio?.primaryLanguage}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Experience</div>
                                            <div className="text-zinc-300 text-sm">{rec.bio?.experienceLevel}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-3 mt-auto">
                                    <button 
                                        onClick={() => handleDismiss(rec.id)}
                                        className="py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Skip
                                    </button>
                                    <button
                                        onClick={() => handleBlock(rec)}
                                        className="py-2.5 rounded-xl border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors text-sm font-medium"
                                    >
                                        Block
                                    </button>
                                    <button 
                                        onClick={() => handleConnect(rec.id)}
                                        className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all text-sm font-medium"
                                    >
                                        Connect
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Matches;
