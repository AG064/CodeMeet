import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

type BioForm = {
  primaryLanguage: string;
  experienceLevel: string;
  lookFor: string;
  preferredOs: string;
  codingStyle: string;
  city: string;
};

type BioErrors = Partial<Record<keyof BioForm, string>>;

const defaultBio: BioForm = {
  primaryLanguage: '',
  experienceLevel: '',
  lookFor: '',
  preferredOs: '',
  codingStyle: '',
  city: '',
};

const primaryLanguageOptions = ['TypeScript', 'JavaScript', 'Java', 'Python', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP'];
const experienceLevelOptions = ['Beginner', 'Junior', 'Mid', 'Senior', 'Lead', 'Principal'];
const lookForOptions = ['Pair Programming', 'Hackathon Teammate', 'Long-term Project', 'Mentor', 'Mentee', 'Code Review Partner', 'Co-Founder'];
const preferredOsOptions = ['Windows', 'Linux', 'macOS', 'WSL', 'Unix'];
const codingStyleOptions = ['Clean Code', 'Pragmatic', 'TDD', 'Fast Prototyping', 'Architecture-first', 'Functional', 'OOP'];

const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const toCsv = (values: string[]): string => values.join(', ');

const calculateCompletion = (bio: BioForm): number => {
  const fields: (keyof BioForm)[] = ['primaryLanguage', 'experienceLevel', 'lookFor', 'preferredOs', 'codingStyle', 'city'];
  const filled = fields.filter((field) => bio[field].trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
};

const SetupBio: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<BioForm>(defaultBio);
  const [aboutMe, setAboutMe] = useState('');
  const [errors, setErrors] = useState<BioErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const completion = calculateCompletion(form);
  const ringSize = 100;
  const stroke = 8;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - completion / 100);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      navigate('/login');
      return;
    }

    const preloadBio = async () => {
      try {
        const res = await api.get('/me/bio');
        setForm({
          primaryLanguage: res.data?.primaryLanguage || '',
          experienceLevel: res.data?.experienceLevel || '',
          lookFor: res.data?.lookFor || '',
          preferredOs: res.data?.preferredOs || '',
          codingStyle: res.data?.codingStyle || '',
          city: res.data?.city || '',
        });
      } catch {
        // No existing bio yet is fine; keep defaults.
      }
      try {
        const profileRes = await api.get('/me/profile');
        setAboutMe(profileRes.data?.aboutMe || '');
      } catch {
        // No profile yet
      }
      setLoading(false);
    };

    preloadBio();
  }, [navigate]);

  const onChange = (field: keyof BioForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const onSelectOption = (field: keyof BioForm, option: string) => {
    const current = splitCsv(form[field]);
    let next: string[];
    
    // Single select for experience level
    if (field === 'experienceLevel') {
        next = [option];
    } else {
        // Multi select for others
        if (current.includes(option)) {
            next = current.filter(i => i !== option);
        } else {
            if (current.length >= 3) return; // Max 3
            next = [...current, option];
        }
    }
    
    onChange(field, toCsv(next));
  };

  const validateField = (field: keyof BioForm, value: string): string => {
    const trimmed = value.trim();

    if (!trimmed) {
      return 'Required';
    }

    if (field === 'experienceLevel') {
      if (!experienceLevelOptions.includes(trimmed)) {
        return 'Invalid selection';
      }
      return '';
    }

    if (field === 'city') {
      if (trimmed.length < 2) return 'Too short';
      if (trimmed.length > 40) return 'Too long';
      if (!/^[a-zA-ZÀ-ž\s'-]+$/.test(trimmed)) return 'Invalid characters';
      return '';
    }

    const selectedCount = splitCsv(trimmed).length;
    if (selectedCount === 0) return 'Select at least one';
    if (selectedCount > 3) return 'Max 3 choices';

    return '';
  };

  const validateForm = (): boolean => {
    const nextErrors: BioErrors = {};
    const fields: (keyof BioForm)[] = ['primaryLanguage', 'experienceLevel', 'lookFor', 'preferredOs', 'codingStyle', 'city'];

    fields.forEach((field) => {
      const message = validateField(field, form[field]);
      if (message) {
        nextErrors[field] = message;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Check fields');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/me/bio', form);
      await api.post('/me/profile', { aboutMe });
      setSuccess('Profile updated successfully');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      const backendMessage = typeof err?.response?.data === 'string'
        ? err.response.data
        : err?.response?.data?.message;
      setError(backendMessage || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderMultiSelect = (field: keyof BioForm, options: string[], label: string) => {
    const selected = splitCsv(form[field]);
    const hasError = !!errors[field];

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">{label}</label>
                {hasError && <span className="text-rose-500 text-xs">{errors[field]}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const isActive = selected.includes(opt);
                    return (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => onSelectOption(field, opt)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                isActive 
                                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm' 
                                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                            }`}
                        >
                            {opt}
                        </button>
                    );
                })}
            </div>
        </div>
    );
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full text-zinc-500 font-medium animate-pulse">
            LOADING CONFIGURATION...
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      <div className="flex justify-between items-end mb-8">
        <div>
           <h1 className="text-3xl font-bold text-zinc-100">Profile Setup</h1>
           <p className="text-zinc-500 mt-1">Define your parameters to help us find compatible nodes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                {error && <div className="absolute top-0 left-0 w-full bg-rose-500/20 text-rose-300 text-xs px-4 py-1 text-center">{error}</div>}
                {success && <div className="absolute top-0 left-0 w-full bg-emerald-500/20 text-emerald-300 text-xs px-4 py-1 text-center">{success}</div>}
                
                <form id="bio-form" onSubmit={handleSubmit} className="space-y-8 mt-2">
                    {renderMultiSelect('primaryLanguage', primaryLanguageOptions, 'Primary Stack (Max 3)')}
                    
                    <div className="space-y-4">
                        <div className="flex flex-col space-y-2">
                             <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Years of Experience</label>
                             <div className="grid grid-cols-3 gap-2">
                                {experienceLevelOptions.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onSelectOption('experienceLevel', opt)}
                                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                                            form.experienceLevel === opt
                                                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' 
                                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                             </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                         <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Operating Base (City)</label>
                         <input
                            value={form.city}
                            onChange={(e) => onChange('city', e.target.value)}
                            placeholder="e.g. San Francisco"
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                         />
                         {errors.city && <span className="text-rose-500 text-xs">{errors.city}</span>}
                    </div>

                    {renderMultiSelect('lookFor', lookForOptions, 'Looking For (Max 3)')}
                    {renderMultiSelect('codingStyle', codingStyleOptions, 'Work Style (Max 3)')}
                    {renderMultiSelect('preferredOs', preferredOsOptions, 'Preferred Environment (Max 3)')}

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">About Me</label>
                            <span className="text-xs text-zinc-600">{aboutMe.length}/1000</span>
                        </div>
                        <textarea
                            value={aboutMe}
                            onChange={(e) => { if (e.target.value.length <= 1000) setAboutMe(e.target.value); }}
                            placeholder="Tell others a bit about yourself — what you're working on, what motivates you, or anything you'd like people to know..."
                            rows={4}
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm resize-none"
                        />
                    </div>
                </form>
              </div>
          </div>

          {/* Right Column: Status + Actions */}
          <div className="lg:col-span-1">
             <div className="sticky top-6 space-y-4">
             <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center">
                 <div className="relative inline-flex items-center justify-center p-4">
                    <svg width={ringSize} height={ringSize} className="-rotate-90">
                        <circle
                            cx={ringSize / 2}
                            cy={ringSize / 2}
                            r={radius}
                            stroke="#18181b" 
                            strokeWidth={stroke}
                            fill="transparent"
                        />
                        <circle
                            cx={ringSize / 2}
                            cy={ringSize / 2}
                            r={radius}
                            stroke={completion === 100 ? '#10b981' : '#6366f1'}
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className={`text-2xl font-bold ${completion === 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>
                            {completion}%
                        </span>
                        <span className="text-[10px] uppercase text-zinc-500 tracking-widest">Complete</span>
                    </div>
                 </div>
                 
                 <div className="mt-4">
                    <h3 className="text-zinc-200 font-medium">Profile Status</h3>
                    <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
                        {completion < 50 ? 'Low visibility. Complete your profile to appear in search results.' : 
                         completion < 100 ? 'Good progress. Add more details to improve match quality.' : 
                         'Optimized. Your profile is ready for maximum visibility.'}
                    </p>
                 </div>
             </div>

             {/* Save / Cancel */}
             <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col gap-2">
                <button
                    type="submit"
                    form="bio-form"
                    disabled={saving}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all font-medium disabled:opacity-50"
                >
                    {saving ? 'Syncing...' : 'Save Configuration'}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="w-full py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                    Cancel
                </button>
             </div>
             </div>
          </div>
      </div>
    </div>
  );
};

export default SetupBio;
