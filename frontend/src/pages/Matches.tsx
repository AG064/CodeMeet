import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { IconUser, IconSearch } from '../components/Icons';
import { formatDistanceKm } from '../utils/location';
import { getBackendBaseUrl } from '../utils/network';

const BACKEND_BASE_URL = getBackendBaseUrl();

type Candidate = {
    id: string;
    name: string;
    profilePicture?: string;
    bio?: {
        primaryLanguage?: string;
        experienceLevel?: string;
        city?: string;
        maxDistanceKm?: number;
        locationVisible?: boolean;
        lookFor?: string;
        age?: number;
        ageVisible?: boolean;
    };
    matchScore?: number;
    distanceKm?: number;
};

const Matches: React.FC = () => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [fatalError, setFatalError] = useState<string | null>(null);
    const navigate = typeof window !== 'undefined' ? (window as any).useNavigate?.() || (() => {}) : () => {};

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
            setFatalError(null);
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
                        const [userRes, bioRes, scoreRes] = await Promise.all([
                            api.get(`/users/${rec.id}`),
                            api.get(`/users/${rec.id}/bio`).catch(() => ({ data: {} })),
                            api.get(`/recommendations/${rec.id}/score`).catch(() => ({ data: {} }))
                        ]);

                        return {
                            id: rec.id,
                            name: userRes?.data?.name || 'Unknown User',
                            profilePicture: userRes?.data?.profilePicture || null,
                            bio: {
                                primaryLanguage: bioRes.data?.primaryLanguage || 'N/A',
                                experienceLevel: bioRes.data?.experienceLevel || 'Undisclosed',
                                city: bioRes.data?.city,
                                maxDistanceKm: bioRes.data?.maxDistanceKm,
                                locationVisible: bioRes.data?.locationVisible !== false,
                                age: bioRes.data?.age,
                                ageVisible: bioRes.data?.ageVisible !== false,
                            },
                            matchScore: typeof scoreRes.data?.matchScore === 'number' ? scoreRes.data.matchScore : undefined,
                            distanceKm: typeof scoreRes.data?.distanceKm === 'number' ? scoreRes.data.distanceKm : undefined,
                        };
                    } catch (error: any) {
                        if (error?.response?.status === 403) {
                            setFatalError('Access forbidden. You do not have permission to view recommendations.');
                        } else if (error?.response?.status === 401) {
                            setFatalError('Session expired or not authenticated. Please log in again.');
                        }
                        return { id: rec.id, name: 'Error', bio: {} } as Candidate;
                    }
                })
            );

            setCandidates(detailedCandidates);
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setFatalError('Access forbidden. You do not have permission to view recommendations.');
            } else if (err?.response?.status === 401) {
                setFatalError('Session expired or not authenticated. Please log in again.');
            } else {
                console.error(err);
            }
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
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setFatalError('Access forbidden. You do not have permission to connect.');
            } else if (err?.response?.status === 401) {
                setFatalError('Session expired or not authenticated. Please log in again.');
            } else {
                console.error(err);
                setActionError('Could not send the connection request.');
            }
        }
    };

    const handleDismiss = async (userId: string) => {
        try {
            setActionError(null);
            setActionSuccess(null);
            await api.post(`/recommendations/skip/${userId}`);
            setCandidates(prev => prev.filter(c => c.id !== userId));
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setFatalError('Access forbidden. You do not have permission to skip users.');
            } else if (err?.response?.status === 401) {
                setFatalError('Session expired or not authenticated. Please log in again.');
            } else {
                console.error("Failed to skip user:", err);
                setActionError('Could not skip this user right now.');
            }
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
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setFatalError('Access forbidden. You do not have permission to block users.');
            } else if (err?.response?.status === 401) {
                setFatalError('Session expired or not authenticated. Please log in again.');
            } else {
                console.error('Failed to block user:', err);
                setActionError('Could not block this user right now.');
            }
        }
    };

    if (fatalError) {
        return (
            <div className="flex h-full min-h-0 w-full items-center justify-center bg-transparent rounded-3xl shadow-2xl border border-white/5 animate-fade-in relative backdrop-blur-sm">
                <div className="max-w-md w-full mx-auto p-8 bg-zinc-900/80 rounded-2xl border border-white/10 flex flex-col items-center gap-6">
                    <FeedbackBanner variant="error" className="w-full text-center">
                        {fatalError}
                    </FeedbackBanner>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-2 px-6 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-500 transition-all"
                    >
                        Go back
                    </button>
                </div>
            </div>
        );
    }

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
                                    <span className="truncate max-w-[140px]">{rec.bio?.locationVisible === false ? 'Location hidden' : (rec.bio?.city || 'City unavailable')}</span>
                                    <span>•</span>
                                    <span className="text-indigo-400 font-mono">ID: {rec.id.split('-')[0]}</span>
                                </div>

                                <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
                                    {rec.bio?.locationVisible !== false && rec.distanceKm != null && (
                                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                                            {formatDistanceKm(rec.distanceKm)}
                                        </span>
                                    )}
                                    {rec.matchScore != null && (
                                        <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-indigo-300">
                                            Match score {rec.matchScore}
                                        </span>
                                    )}
                                    {rec.bio?.locationVisible !== false && rec.bio?.maxDistanceKm != null && (
                                        <span className="rounded-full border border-white/10 bg-zinc-900/50 px-2.5 py-1 text-zinc-400">
                                            Radius {rec.bio.maxDistanceKm} km
                                        </span>
                                    )}
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
                                        <div className="flex-1 bg-zinc-900/50 rounded-lg p-3 border border-white/5">
                                            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">City</div>
                                            <div className="text-zinc-300 text-sm">{rec.bio?.locationVisible === false ? 'Hidden' : (rec.bio?.city || 'Unavailable')}</div>
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
