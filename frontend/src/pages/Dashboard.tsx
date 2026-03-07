import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { IconCamera, IconCode, IconChart, IconTarget, IconLaptop, IconMapPin, IconWarning, IconSearch, IconNetwork, IconMessage, IconCheck, IconUser, IconMore } from '../components/Icons';
import { toHandle } from '../utils/handle';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

type Bio = {
    primaryLanguage?: string;
    experienceLevel?: string;
    lookFor?: string;
    preferredOs?: string;
    codingStyle?: string;
    latitude?: number;
    longitude?: number;
    maxDistanceKm?: number;
    age?: number;
};

type FeedbackState = {
    variant: 'success' | 'error';
    message: string;
};

type CurrentUser = {
    id: string;
    name: string;
    profilePicture?: string | null;
};

type ProfileResponse = {
    aboutMe?: string;
};

const Dashboard: React.FC = () => {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [bio, setBio] = useState<Bio | null>(null);
    const [aboutMe, setAboutMe] = useState('');
    const [uploading, setUploading] = useState(false);
    const [removingPicture, setRemovingPicture] = useState(false);
    const [aliasInput, setAliasInput] = useState('');
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const navigate = useNavigate();

    const refreshCurrentUser = async () => {
        const userRes = await api.get<CurrentUser>('/me');
        setUser(userRes.data);
        setAliasInput(userRes.data?.name || '');
    };

    const calculateCompletion = (bioData: Bio | null): number => {
        if (!bioData) return 0;

        // Location counts as one completed profile item only when all three location fields are present.
        const hasLocationConfigured = bioData.latitude != null && bioData.longitude != null && bioData.maxDistanceKm != null;

        const values = [
            bioData.primaryLanguage,
            bioData.experienceLevel,
            bioData.lookFor,
            bioData.preferredOs,
            bioData.codingStyle,
            hasLocationConfigured ? 'location-ready' : '',
            bioData.age != null ? String(bioData.age) : '',
        ];

        const filled = values.filter((value) => (value || '').trim().length > 0).length;
        return Math.round((filled / values.length) * 100);
    };

    const completion = calculateCompletion(bio);
    const ringSize = 96;
    const stroke = 8;
    const radius = (ringSize - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    // SVG progress rings are drawn with stroke length, so a smaller offset shows more completion.
    const dashOffset = circumference * (1 - completion / 100);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userRes = await api.get<CurrentUser>('/me');
                setUser(userRes.data);
                setAliasInput(userRes.data?.name || '');
                
                try {
                    const bioRes = await api.get<Bio>('/me/bio');
                    setBio(bioRes.data);
                } catch {
                    // Bio is optional for new accounts.
                }
                try {
                    const profileRes = await api.get<ProfileResponse>('/me/profile');
                    setAboutMe(profileRes.data?.aboutMe || '');
                } catch {
                    // Profile text is optional.
                }
            } catch {
                navigate('/login');
            }
        };
        fetchData();
    }, [navigate]);

    const handleAliasUpdate = async () => {
        const trimmed = aliasInput.trim();
        if (!trimmed) {
            setFeedback({ variant: 'error', message: 'Alias cannot be empty.' });
            return;
        }

        try {
            await api.post('/me/alias', { name: trimmed });
            await refreshCurrentUser();
            setAliasInput(trimmed);
            setFeedback({ variant: 'success', message: 'Alias updated successfully.' });
        } catch (error: unknown) {
            setFeedback({
                variant: 'error',
                message: getApiErrorMessage(error, 'Could not update your alias right now.')
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setFeedback(null);
        
        try {
            await api.post('/me/profile-picture', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setFeedback({ variant: 'success', message: 'Avatar updated successfully.' });
            await refreshCurrentUser();
        } catch (error: unknown) {
            setFeedback({
                variant: 'error',
                message: getApiErrorMessage(error, 'Could not upload your avatar right now.')
            });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveProfilePicture = async () => {
        if (!user?.profilePicture || removingPicture) {
            return;
        }

        setRemovingPicture(true);
        setFeedback(null);

        try {
            await api.delete('/me/profile-picture');
            await refreshCurrentUser();
            setFeedback({ variant: 'success', message: 'Avatar removed successfully.' });
            setIsProfileMenuOpen(false);
        } catch (error: unknown) {
            setFeedback({
                variant: 'error',
                message: getApiErrorMessage(error, 'Could not remove your avatar right now.')
            });
        } finally {
            setRemovingPicture(false);
        }
    };

    if (!user) return (
        <div className="flex items-center justify-center h-full text-zinc-500 font-medium animate-pulse">
            LOADING PROFILE DATA...
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                   <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400">
                      Welcome back, {user.name}
                   </h1>
                   <p className="text-zinc-500 mt-1">Here is your digital footprint overview.</p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Identity card */}
                 <div className="cyber-card p-8 lg:col-span-1 flex flex-col items-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            className="text-zinc-500 hover:text-indigo-400"
                            aria-label="Profile options"
                            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                        >
                            <IconMore className="w-5 h-5" />
                        </button>
                    </div>

                    {isProfileMenuOpen && (
                        <div className="absolute top-12 right-4 z-20 w-44 rounded-xl border border-white/10 bg-zinc-900/95 p-2 text-left shadow-xl backdrop-blur-xl">
                            <button
                                onClick={() => {
                                    setIsProfileMenuOpen(false);
                                    navigate(`/profile/${user.id}`);
                                }}
                                className="w-full rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                            >
                                View public profile
                            </button>
                            <button
                                onClick={() => {
                                    setIsProfileMenuOpen(false);
                                    navigate('/settings');
                                }}
                                className="w-full rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                            >
                                Open settings
                            </button>
                            <button
                                onClick={() => {
                                    setIsProfileMenuOpen(false);
                                    navigate('/setup-bio');
                                }}
                                className="w-full rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                            >
                                Edit bio
                            </button>
                            {user.profilePicture && (
                                <button
                                    onClick={handleRemoveProfilePicture}
                                    disabled={removingPicture}
                                    className="w-full rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {removingPicture ? 'Removing avatar…' : 'Remove avatar'}
                                </button>
                            )}
                        </div>
                    )}
                    
                    <div className="relative mb-6">
                        <div className="w-32 h-32 rounded-full border-4 border-zinc-800 bg-zinc-900 overflow-hidden shadow-2xl relative z-10 box-border">
                            {user.profilePicture ? (
                                <img src={`${BACKEND_BASE_URL}${user.profilePicture}`} alt="Avatar" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
                                   <IconUser className="w-16 h-16"/>
                                </div>
                            )}
                        </div>
                        <div className="absolute inset-0 rounded-full border border-indigo-500/30 scale-110 animate-pulse pointer-events-none"></div>
                        
                        <label className="absolute bottom-0 right-0 bg-zinc-800 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-600 transition-colors shadow-lg border border-zinc-700 z-20">
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                            <span className="text-xs font-bold">{uploading ? '...' : <IconCamera className="w-4 h-4" />}</span>
                        </label>
                    </div>
                    
                    <h2 className="text-xl font-bold text-zinc-100">{user.name}</h2>
                    <p className="text-indigo-400 text-sm font-medium mb-3">{toHandle(user.name)}</p>

                    {aboutMe && (
                      <p className="text-zinc-400 text-xs text-center leading-relaxed mb-4 px-2 line-clamp-3">{aboutMe}</p>
                    )}
                    
                    <div className="w-full space-y-4">
                        <div className="bg-zinc-900/50 rounded-xl p-1 flex items-center border border-zinc-800 focus-within:border-indigo-500/50 transition-colors">
                           <input
                               className="bg-transparent w-full px-4 py-2 text-sm text-center text-zinc-300 placeholder-zinc-600 focus:outline-none"
                               value={aliasInput}
                               onChange={(e) => setAliasInput(e.target.value)}
                               maxLength={40}
                               placeholder="Update alias..."
                           />
                           <button
                               type="button"
                               onClick={handleAliasUpdate}
                               className="bg-zinc-800 hover:bg-indigo-600 text-zinc-400 hover:text-white rounded-lg p-2 transition-colors flex items-center justify-center"
                           >
                               <IconCheck className="w-4 h-4" />
                           </button>
                        </div>
                        
                                {feedback && (
                                    <FeedbackBanner variant={feedback.variant} className="text-center">
                                        {feedback.message}
                                    </FeedbackBanner>
                        )}
                    </div>
                 </div>

                 {/* Bio summary and completion meter */}
                 <div className="cyber-card p-8 lg:col-span-2 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start mb-6 z-10">
                        <div>
                           <h2 className="text-lg font-bold text-zinc-200">Bio Metrics</h2>
                           <p className="text-zinc-500 text-sm">Profile completion status</p>
                        </div>
                        <button 
                           onClick={() => navigate('/setup-bio')}
                           className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 hover:text-indigo-400 border border-zinc-700 hover:border-indigo-500/30 transition-all"
                        >
                           Edit Bio
                        </button>
                    </div>

                    {bio ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 z-10">
                            <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/30 rounded-2xl border border-white/5">
                                <div className="relative w-40 h-40">
                                    <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${ringSize} ${ringSize}`}>
                                        <circle
                                            cx={ringSize / 2}
                                            cy={ringSize / 2}
                                            r={radius}
                                            fill="transparent"
                                            stroke="#27272a"
                                            strokeWidth={stroke}
                                        />
                                        <circle
                                            cx={ringSize / 2}
                                            cy={ringSize / 2}
                                            r={radius}
                                            fill="transparent"
                                            stroke="url(#gradient)"
                                            strokeWidth={stroke}
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={dashOffset}
                                            className="transition-all duration-1000 ease-out"
                                        />
                                        <defs>
                                           <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                              <stop offset="0%" stopColor="#6366f1" />
                                              <stop offset="100%" stopColor="#a855f7" />
                                           </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-white">{completion}%</span>
                                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Complete</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {[
                                   { label: 'Primary Stack', value: bio.primaryLanguage, icon: <IconCode className="w-4 h-4" /> },
                                   { label: 'Level', value: bio.experienceLevel, icon: <IconChart className="w-4 h-4" /> },
                                   { label: 'Looking For', value: bio.lookFor, icon: <IconTarget className="w-4 h-4" /> },
                                              { label: 'Age', value: bio.age != null ? String(bio.age) : '', icon: <IconUser className="w-4 h-4" /> },
                                   { label: 'OS', value: bio.preferredOs, icon: <IconLaptop className="w-4 h-4" /> },
                                              { label: 'Match Radius', value: bio.maxDistanceKm != null ? `${bio.maxDistanceKm} km` : '', icon: <IconMapPin className="w-4 h-4" /> },
                                              { label: 'GPS Location', value: bio.latitude != null && bio.longitude != null ? `${bio.latitude.toFixed(3)}, ${bio.longitude.toFixed(3)}` : '', icon: <IconMapPin className="w-4 h-4" /> },
                                ].map((item, i) => (
                                   <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                                      <span className="text-zinc-500 text-sm flex items-center gap-2">{item.icon} {item.label}</span>
                                      <span className="text-zinc-200 font-medium text-sm">{item.value || '—'}</span>
                                   </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/30 rounded-2xl border border-white/5 border-dashed p-8">
                            <div className="text-4xl mb-4 opacity-50 flex items-center justify-center"><IconWarning className="w-12 h-12 text-zinc-600" /></div>
                            <h3 className="text-zinc-300 font-medium mb-2">Profile Incomplete</h3>
                            <p className="text-zinc-500 text-sm text-center mb-6 max-w-xs">
                                Complete your bio to unlock recommendations and start connecting with others.
                            </p>
                            <button className="btn-primary" onClick={() => navigate('/setup-bio')}>
                                Initialize Bio Profile
                            </button>
                        </div>
                    )}
                 </div>
             </div>

             {/* Shortcut actions */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div onClick={() => navigate('/matches')} className="cyber-card p-6 cursor-pointer group hover:bg-indigo-900/10">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 text-2xl flex items-center justify-center mb-4 text-indigo-400 group-hover:scale-110 transition-transform"><IconSearch className="w-6 h-6" /></div>
                    <h3 className="text-lg font-bold text-zinc-200 mb-2">Discover Matches</h3>
                    <p className="text-zinc-500 text-sm">Find new connections suitable for your profile.</p>
                 </div>
                 <div onClick={() => navigate('/connections')} className="cyber-card p-6 cursor-pointer group hover:bg-indigo-900/10">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 text-2xl flex items-center justify-center mb-4 text-purple-400 group-hover:scale-110 transition-transform"><IconNetwork className="w-6 h-6" /></div>
                    <h3 className="text-lg font-bold text-zinc-200 mb-2">My Network</h3>
                    <p className="text-zinc-500 text-sm">Manage pending requests and active connections.</p>
                 </div>
                 <div onClick={() => navigate('/chat')} className="cyber-card p-6 cursor-pointer group hover:bg-indigo-900/10">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800 text-2xl flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform"><IconMessage className="w-6 h-6" /></div>
                    <h3 className="text-lg font-bold text-zinc-200 mb-2">Comms Channels</h3>
                    <p className="text-zinc-500 text-sm">Real-time messaging with your network.</p>
                 </div>
             </div>
        </div>
    );
};

export default Dashboard;
