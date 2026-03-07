import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';

type BioForm = {
  primaryLanguage: string;
  experienceLevel: string;
  lookFor: string;
  preferredOs: string;
  codingStyle: string;
  latitude: string;
  longitude: string;
  maxDistanceKm: string;
  age: string;
};

type BioErrors = Partial<Record<keyof BioForm, string>>;

const defaultBio: BioForm = {
  primaryLanguage: '',
  experienceLevel: '',
  lookFor: '',
  preferredOs: '',
  codingStyle: '',
  latitude: '',
  longitude: '',
  maxDistanceKm: '',
  age: '',
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
  const values = [
    bio.primaryLanguage,
    bio.experienceLevel,
    bio.lookFor,
    bio.preferredOs,
    bio.codingStyle,
    bio.age,
    bio.latitude && bio.longitude && bio.maxDistanceKm ? 'location-ready' : '',
  ];

  const filled = values.filter((value) => value.trim().length > 0).length;
  return Math.round((filled / values.length) * 100);
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
  const [gpsStatus, setGpsStatus] = useState('');
  const [locating, setLocating] = useState(false);

  const completion = calculateCompletion(form);
  const ringSize = 100;
  const stroke = 8;
  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // The ring uses the remaining stroke length, not the completed percentage directly.
  const dashOffset = circumference * (1 - completion / 100);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      navigate('/login');
      return;
    }

    const preloadBio = async () => {
      // Load saved bio and profile text so the form works for both first-time setup and later edits.
      try {
        const res = await api.get('/me/bio');
        setForm({
          primaryLanguage: res.data?.primaryLanguage || '',
          experienceLevel: res.data?.experienceLevel || '',
          lookFor: res.data?.lookFor || '',
          preferredOs: res.data?.preferredOs || '',
          codingStyle: res.data?.codingStyle || '',
          latitude: res.data?.latitude != null ? String(res.data.latitude) : '',
          longitude: res.data?.longitude != null ? String(res.data.longitude) : '',
          maxDistanceKm: res.data?.maxDistanceKm != null ? String(res.data.maxDistanceKm) : '',
          age: res.data?.age != null ? String(res.data.age) : '',
        });
      } catch {
        // Missing bio is expected for first-time setup.
      }
      try {
        const profileRes = await api.get('/me/profile');
        setAboutMe(profileRes.data?.aboutMe || '');
      } catch {
        // Missing profile text is valid for first-time setup.
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

    // Experience is single-choice; the other chip groups allow up to three selections.
    if (field === 'experienceLevel') {
      next = [option];
    } else {
      if (current.includes(option)) {
        next = current.filter(i => i !== option);
      } else {
        if (current.length >= 3) return;
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

    if (field === 'latitude') {
      const latitude = Number(trimmed);
      if (Number.isNaN(latitude)) return 'Enter a valid latitude';
      if (latitude < -90 || latitude > 90) return 'Latitude must be between -90 and 90';
      return '';
    }

    if (field === 'longitude') {
      const longitude = Number(trimmed);
      if (Number.isNaN(longitude)) return 'Enter a valid longitude';
      if (longitude < -180 || longitude > 180) return 'Longitude must be between -180 and 180';
      return '';
    }

    if (field === 'maxDistanceKm') {
      if (!/^\d+$/.test(trimmed)) return 'Numbers only';
      const radius = Number(trimmed);
      if (radius < 1 || radius > 500) return 'Radius must be 1-500 km';
      return '';
    }

    if (field === 'age') {
      if (!/^\d+$/.test(trimmed)) return 'Numbers only';
      const age = Number(trimmed);
      if (age < 13 || age > 120) return 'Age must be 13-120';
      return '';
    }

    const selectedCount = splitCsv(trimmed).length;
    if (selectedCount === 0) return 'Select at least one';
    if (selectedCount > 3) return 'Max 3 choices';

    return '';
  };

  const validateForm = (): boolean => {
    const nextErrors: BioErrors = {};
    const fields: (keyof BioForm)[] = ['primaryLanguage', 'experienceLevel', 'lookFor', 'preferredOs', 'codingStyle', 'latitude', 'longitude', 'maxDistanceKm', 'age'];

    fields.forEach((field) => {
      const message = validateField(field, form[field]);
      if (message) {
        nextErrors[field] = message;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('This browser does not support GPS location capture.');
      return;
    }

    // Browser geolocation fills the coordinate fields and provides a default radius if none was chosen yet.
    setLocating(true);
    setGpsStatus('Requesting your current coordinates...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude.toFixed(6);
        const nextLongitude = position.coords.longitude.toFixed(6);
        setForm((prev) => ({
          ...prev,
          latitude: nextLatitude,
          longitude: nextLongitude,
          maxDistanceKm: prev.maxDistanceKm || '25',
        }));
        setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));
        setGpsStatus(`Location captured with ±${Math.round(position.coords.accuracy)} m accuracy.`);
        setLocating(false);
      },
      (geoError) => {
        setGpsStatus(geoError.message || 'Could not read your current location.');
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
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
      await api.post('/me/bio', {
        ...form,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        maxDistanceKm: Number(form.maxDistanceKm),
        age: Number(form.age),
      });
      await api.post('/me/profile', { aboutMe });
      setSuccess('Profile updated successfully');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (error: unknown) {
      const status = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined;

      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      setError(getApiErrorMessage(error, 'Failed to save'));
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
            {hasError && <span className="text-red-300 text-xs">{errors[field]}</span>}
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
        {/* Editable bio form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="space-y-4">
                  {error && <FeedbackBanner variant="error">{error}</FeedbackBanner>}
                  {success && <FeedbackBanner variant="success">{success}</FeedbackBanner>}
                </div>

                <form id="bio-form" onSubmit={handleSubmit} className="space-y-8 mt-4">
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

                      <div className="space-y-4 rounded-2xl border border-white/5 bg-zinc-900/30 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">GPS Match Location</label>
                            <p className="text-xs text-zinc-500 mt-1">Use your browser location for radius-based recommendations.</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={locating}
                            className="px-4 py-2 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {locating ? 'Locating…' : 'Use current location'}
                          </button>
                        </div>

                        {gpsStatus && <FeedbackBanner variant="info">{gpsStatus}</FeedbackBanner>}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Latitude</label>
                            <input
                              type="number"
                              step="0.000001"
                              value={form.latitude}
                              onChange={(e) => onChange('latitude', e.target.value)}
                              placeholder="e.g. 59.437000"
                              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                            />
                            {errors.latitude && <span className="text-red-300 text-xs">{errors.latitude}</span>}
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Longitude</label>
                            <input
                              type="number"
                              step="0.000001"
                              value={form.longitude}
                              onChange={(e) => onChange('longitude', e.target.value)}
                              placeholder="e.g. 24.753600"
                              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                            />
                            {errors.longitude && <span className="text-red-300 text-xs">{errors.longitude}</span>}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Search radius (km)</label>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={form.maxDistanceKm}
                            onChange={(e) => onChange('maxDistanceKm', e.target.value)}
                            placeholder="e.g. 25"
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                          />
                          {errors.maxDistanceKm && <span className="text-red-300 text-xs">{errors.maxDistanceKm}</span>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Age</label>
                        <input
                           type="number"
                           min={13}
                           max={120}
                           value={form.age}
                           onChange={(e) => onChange('age', e.target.value)}
                           placeholder="e.g. 27"
                           className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                        />
                        {errors.age && <span className="text-red-300 text-xs">{errors.age}</span>}
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

        {/* Live completion summary */}
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
