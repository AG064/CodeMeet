import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/auth/login', { email, password });
            // Handle both string token (legacy) and object token
            const token = typeof res.data === 'string' ? res.data : res.data?.token;
            
            if (!token) {
                 throw new Error('Authentication failed: No token received');
            }
            
            localStorage.setItem('token', token);
            navigate('/dashboard');
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || err.response?.data || 'Invalid credentials';
            setError(typeof msg === 'string' ? msg : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px]"></div>
            </div>

            <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-white/5 relative z-10 shadow-2xl shadow-indigo-500/10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">CodeMeet.</h1>
                    <p className="text-zinc-500 text-sm">Professional networking for the discerning developer.</p>
                </div>

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Email</label>
                        <input
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                            required
                        />
                    </div>
                    
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Password</label>
                            <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                        </div>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                    
                    <div className="mt-8 text-center text-zinc-500 text-sm">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-indigo-400 font-medium hover:text-indigo-300 transition-colors">
                            Create access node
                        </Link>
                    </div>
                </form>
            </div>
            
            <div className="absolute bottom-6 text-zinc-800 text-xs font-mono">
                SYSTEM_VERSION: v2.4.0
            </div>
        </div>
    );
};

export default Login;
