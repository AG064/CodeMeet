import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api/axios';
import FeedbackBanner from '../components/FeedbackBanner.tsx';
import { geocodeCity } from '../utils/geocode';

type BioForm = {
  primaryLanguage: string;
  experienceLevel: string;
  lookFor: string;
  preferredOs: string;
  codingStyle: string;
  city: string;
  latitude: string; // kept for backend compatibility, but hidden from UI
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
  city: '',
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
  const hasLocationConfigured = Boolean(bio.city.trim() && bio.latitude && bio.longitude && bio.maxDistanceKm);
  const values = [
    bio.primaryLanguage,
    bio.experienceLevel,
    bio.lookFor,
    bio.preferredOs,
    bio.codingStyle,
    bio.age,
    hasLocationConfigured ? 'location-ready' : '',
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

  // Geocode city input automatically
  useEffect(() => {
    const city = form.city.trim();
    if (!city) {
      // If city is cleared, also clear coordinates
      if (form.latitude || form.longitude) {
        setForm((prev) => ({ ...prev, latitude: '', longitude: '' }));
      }
      return;
    }
    let ignore = false;
    // Only geocode if city changed and not currently locating
    if (city && !locating) {
      (async () => {
        const geo = await geocodeCity(city);
        if (!ignore) {
          if (geo) {
            setForm((prev) => ({ ...prev, latitude: geo.latitude.toFixed(6), longitude: geo.longitude.toFixed(6) }));
            setGpsStatus('Coordinates set for city.');
          } else {
            setForm((prev) => ({ ...prev, latitude: '', longitude: '' }));
            setGpsStatus('Could not find coordinates for this city.');
          }
        }
      })();
    }
    return () => { ignore = true; };
  }, [form.city]);

  const onSelectOption = (field: keyof BioForm, option: string) => {
    const current = splitCsv(form[field]);
    let next: string[];

    if (field === 'experienceLevel') {
      next = [option];
    } else if (current.includes(option)) {
      next = current.filter((item) => item !== option);
    } else {
      if (current.length >= 3) return;
      next = [...current, option];
    }

    onChange(field, toCsv(next));
  };

  const validateField = (field: keyof BioForm, value: string): string => {
    const trimmed = value.trim();

    if (field === 'city') {
      if (!trimmed) return 'City is required';
      if (!form.latitude || !form.longitude) return 'Use current location to capture coordinates';
      if (trimmed.length < 2) return 'City name is too short';
      return '';
    }

    if (field === 'maxDistanceKm') {
      if (!trimmed) return 'Required';
      if (!/^\d+$/.test(trimmed)) return 'Numbers only';
      const selectedRadius = Number(trimmed);
      if (selectedRadius < 1 || selectedRadius > 500) return 'Radius must be 1-500 km';
      return '';
    }

    if (field === 'age') {
      if (!trimmed) return 'Required';
      if (!/^\d+$/.test(trimmed)) return 'Numbers only';
      const parsedAge = Number(trimmed);
      if (parsedAge < 13 || parsedAge > 120) return 'Age must be 13-120';
      return '';
    }

    if (!trimmed) {
      return 'Required';
    }

    if (field === 'experienceLevel') {
      return experienceLevelOptions.includes(trimmed) ? '' : 'Invalid selection';
    }

    const selectedCount = splitCsv(trimmed).length;
    if (selectedCount === 0) return 'Select at least one';
    if (selectedCount > 3) return 'Max 3 choices';
    return '';
  };

  const validateForm = (): boolean => {
    const nextErrors: BioErrors = {};
    const fields: (keyof BioForm)[] = ['primaryLanguage', 'experienceLevel', 'lookFor', 'preferredOs', 'codingStyle', 'city', 'maxDistanceKm', 'age'];

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
    setLocating(true);
    setGpsStatus('Requesting your current coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextLatitude = position.coords.latitude.toFixed(6);
        const nextLongitude = position.coords.longitude.toFixed(6);
        setForm((prev) => ({
          ...prev,
          latitude: nextLatitude,
          longitude: nextLongitude,
        }));
        setGpsStatus('Location captured.');
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
      let latitude = form.latitude;
      let longitude = form.longitude;
      // If user location is not set, geocode city
      if (!latitude || !longitude) {
        const geo = await geocodeCity(form.city.trim());
        if (!geo) {
          setError('Could not find coordinates for this city.');
          setSaving(false);
          return;
        }
        latitude = geo.latitude.toFixed(6);
        longitude = geo.longitude.toFixed(6);
      }
      await api.post('/me/bio', {
        ...form,
        city: form.city.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        maxDistanceKm: Number(form.maxDistanceKm),
        age: Number(form.age),
      });
      await api.post('/me/profile', { aboutMe });
      setSuccess('Profile updated successfully');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (requestError: unknown) {
      const status = typeof requestError === 'object' && requestError !== null && 'response' in requestError
        ? (requestError as { response?: { status?: number } }).response?.status
        : undefined;

      if (status === 403) {
        setError('You do not have permission to access this resource. [Go back]');
        setSaving(false);
        return;
      }
      if (status === 404) {
        setError('Resource not found. [Go back]');
        setSaving(false);
        return;
      }
      if (status === 401) {
        // Optionally, show a message or redirect to login if truly unauthenticated
        setError('You are not authenticated. Please log in.');
        setSaving(false);
        return;
      }
      setError(getApiErrorMessage(requestError, 'Failed to save'));
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
          {options.map((option) => {
            const isActive = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectOption(field, option)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {option}
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
          <p className="text-zinc-500 mt-1">Define your parameters to help us find compatible nodes nearby.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden">
            <div className="space-y-4">
              {error && (
                <FeedbackBanner variant="error">
                  {error.includes('[Go back]') ? (
                    <span>
                      {error.replace(' [Go back]', '')}
                      <button
                        type="button"
                        className="ml-2 underline text-indigo-300 hover:text-indigo-400"
                        onClick={() => navigate(-1)}
                      >
                        Go back
                      </button>
                    </span>
                  ) : error}
                </FeedbackBanner>
              )}
              {success && <FeedbackBanner variant="success">{success}</FeedbackBanner>}
            </div>

            <form id="bio-form" onSubmit={handleSubmit} className="space-y-8 mt-4">
              {renderMultiSelect('primaryLanguage', primaryLanguageOptions, 'Primary Stack (Max 3)')}

              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Years of Experience</label>
                  <div className="grid grid-cols-3 gap-2">
                    {experienceLevelOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onSelectOption('experienceLevel', option)}
                        className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                          form.experienceLevel === option
                            ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/5 bg-zinc-900/30 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Proximity Matching</label>
                    <p className="text-xs text-zinc-500 mt-1">You can enter your city or use your current location. Coordinates are never shown to anyone.</p>
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

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">City</label>
                    {errors.city && <span className="text-red-300 text-xs">{errors.city}</span>}
                  </div>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => onChange('city', e.target.value)}
                    placeholder="e.g. Tallinn"
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
                  />
                  <p className="text-xs text-zinc-500">
                    This friendly label is shown in profiles. Exact coordinates stay internal and drive the proximity filter.
                  </p>
                </div>

                {/* Coordinates are never shown to the user or anyone else */}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold">Maximum recommendation radius</label>
                    <div className="rounded-full bg-indigo-600/15 border border-indigo-500/30 px-3 py-1 text-sm font-semibold text-indigo-300 min-w-[84px] text-center">
                      {form.maxDistanceKm || '-'} km
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    step={1}
                    value={form.maxDistanceKm || '25'}
                    onChange={(e) => onChange('maxDistanceKm', e.target.value)}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>1 km</span>
                    <span>Local</span>
                    <span>Regional</span>
                    <span>500 km</span>
                  </div>
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
                  placeholder="Tell others a bit about yourself - what you're working on, what motivates you, or anything you'd like people to know..."
                  rows={4}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm resize-none"
                />
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center">
              <div className="relative inline-flex items-center justify-center p-4">
                <svg width={ringSize} height={ringSize} className="-rotate-90">
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke="var(--color-zinc-900, #18181b)"
                    strokeWidth={stroke}
                    fill="transparent"
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke={completion === 100 ? 'var(--color-emerald-400, #10b981)' : 'var(--color-indigo-500, #6366f1)'}
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
                  {completion < 50
                    ? 'Low visibility. Complete your profile to appear in recommendation results.'
                    : completion < 100
                      ? 'Good progress. Add your city and radius to unlock proximity-based matches.'
                      : 'Optimized. Your profile is ready for proximity-aware recommendations.'}
                </p>
              </div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3 text-sm text-left">
              <h3 className="text-zinc-200 font-medium">Recommendation preview</h3>
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">City label</div>
                <div className="text-zinc-200">{form.city || 'Not set yet'}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Search radius</div>
                <div className="text-zinc-200">{form.maxDistanceKm ? `${form.maxDistanceKm} km` : 'Choose a radius'}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3">
                <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">Spatial filter</div>
                <div className="text-zinc-200">Only candidates inside this radius - and inside theirs - will be recommended.</div>
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
