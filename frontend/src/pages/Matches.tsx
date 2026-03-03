import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { IconUser, IconSearch } from '../components/Icons';

const BACKEND_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

type Candidate = {
    id: string;
    name: string;
    profilePicture?: string;
    bio?: {
        primaryLanguage?: string;
        experienceLevel?: string;
        city?: string;
        lookFor?: string;
    };
    matchScore?: number; // Added for UI
};

const Matches: React.FC = () => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecommendations();
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
                                city: bioRes.data?.city || 'Unknown Location'
                            }
                        };
                    } catch(e) {
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
            await api.post(`/connections/request/${userId}`);
            setCandidates(prev => prev.filter(c => c.id !== userId));
        } catch (err) {
            console.error(err);
        }
    };

    const handleDismiss = async (userId: string) => {
        // Optimistic UI update
        setCandidates(prev => prev.filter(c => c.id !== userId));
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

            {candidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center bg-zinc-900/30 border border-white/5 border-dashed rounded-3xl p-12 text-center h-96">
                    <div className="flex items-center justify-center mb-4 opacity-30 grayscale"><IconSearch className="w-12 h-12 text-zinc-700" /></div>
                    <h3 className="text-xl font-medium text-zinc-300">No new recommendations</h3>
                    <p className="text-zinc-500 mt-2 max-w-md mx-auto">
                        We've run out of matches for now. Try updating your bio to cast a wider net.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {candidates.map((rec) => (
                        <div key={rec.id} className="cyber-card group flex flex-col relative overflow-hidden h-[28rem]">
                            {/* Profile Image Area */}
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
                            
                            {/* Content Area */}
                            <div className="p-6 -mt-12 relative z-10 flex-1 flex flex-col">
                                <h3 className="text-xl font-bold text-zinc-100 mb-0.5">{rec.name}</h3>
                                <div className="flex items-center gap-2 text-zinc-500 text-xs mb-4">
                                    <span className="truncate max-w-[120px]">{rec.bio?.city}</span>
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
                                
                                <div className="flex gap-3 mt-auto">
                                    <button 
                                        onClick={() => handleDismiss(rec.id)}
                                        className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-sm font-medium"
                                    >
                                        Skip
                                    </button>
                                    <button 
                                        onClick={() => handleConnect(rec.id)}
                                        className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all text-sm font-medium"
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
