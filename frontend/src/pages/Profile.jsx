import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, User, Sparkles, BookOpen, Link as LinkIcon, Briefcase } from 'lucide-react';

const Profile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [details, setDetails] = useState('');
    const [domain, setDomain] = useState('');
    const [previousResearch, setPreviousResearch] = useState('');
    const [researchPaper, setResearchPaper] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchUserDetails();
    }, [user]);

    const fetchUserDetails = async () => {
        try {
            const { data } = await axios.get('http://localhost:5000/api/user-details');
            if (data) {
                setDetails(data.details || '');
                setDomain(data.domain || '');
                setPreviousResearch(data.previousResearch || '');
                setResearchPaper(data.researchPaper || '');
            }
        } catch (error) {
            console.error("Failed to fetch user details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            await axios.post('http://localhost:5000/api/user-details', {
                details,
                domain,
                previousResearch,
                researchPaper
            });
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Failed to update profile", error);
            setMessage('Error: Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex justify-center items-center">
            <div className="w-8 h-8 border-2 border-[var(--border-bright)] border-t-[var(--accent-mint)] rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col font-sans bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131B2A] via-[#0A0E17] to-[#05070A]">

            {/* Header */}
            <div className="bg-[#0A0E17]/80 backdrop-blur-md border-b border-[var(--border)] px-8 py-5 flex justify-between items-center sticky top-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-mint)] flex items-center justify-center p-0.5 shadow-[0_0_15px_rgba(123,97,255,0.3)]">
                        <div className="w-full h-full bg-[#0A0E17] rounded-full flex items-center justify-center">
                            <User className="text-[var(--text-primary)]" size={18} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] tracking-wide">Researcher Profile</h1>
                        <p className="text-[11px] font-[var(--font-jetbrains)] text-[var(--text-muted)] uppercase tracking-widest">{user?.name || 'User'}</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-[12px] font-bold font-[var(--font-jetbrains)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider px-4 py-2 border border-transparent hover:border-[var(--border)] rounded bg-[var(--bg-surface)] hover:bg-[#131B2A]"
                >
                    <ArrowLeft size={14} /> Return to Hub
                </button>
            </div>

            <div className="flex-1 p-8 md:p-12 max-w-5xl mx-auto w-full animate-fadeUp">
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.5)] p-8 relative overflow-hidden group">

                    {/* Decorative gradient orb */}
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle,_rgba(123,97,255,0.05)_0%,_rgba(0,0,0,0)_70%)] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-110 transition-transform duration-1000"></div>

                    {message && (
                        <div className={`p-4 rounded-lg mb-8 text-[13px] font-[var(--font-jetbrains)] border flex items-center gap-3 animate-fadeUp ${message.startsWith('Error') ? 'bg-[rgba(255,107,107,0.1)] text-[var(--accent-coral)] border-[rgba(255,107,107,0.3)]' : 'bg-[rgba(79,255,196,0.1)] text-[var(--accent-mint)] border-[rgba(79,255,196,0.3)]'}`}>
                            <Sparkles size={16} /> {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="relative z-10">
                        {/* Section 1: Basic Identity */}
                        <div className="mb-10">
                            <h3 className="text-[12px] font-[var(--font-jetbrains)] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-5 border-b border-[var(--border)] pb-2">Identity Matrix</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        value={user?.name || ''}
                                        disabled
                                        className="w-full bg-[#05070A] border border-[var(--border)] rounded-lg p-3 text-[var(--text-muted)] cursor-not-allowed font-[var(--font-dm-sans)] text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2">Registered Email</label>
                                    <input
                                        type="email"
                                        value={user?.email || ''}
                                        disabled
                                        className="w-full bg-[#05070A] border border-[var(--border)] rounded-lg p-3 text-[var(--text-muted)] cursor-not-allowed font-[var(--font-dm-sans)] text-[14px]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Core Expertise */}
                        <div className="mb-10">
                            <h3 className="text-[12px] font-[var(--font-jetbrains)] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-5 border-b border-[var(--border)] pb-2">Core Expertise</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="group/input">
                                    <label className="block text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2 group-focus-within/input:text-[var(--accent-mint)] transition-colors flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-[var(--accent-violet)] group-focus-within/input:bg-[var(--accent-mint)] transition-colors"></div>
                                        Domain/Field of Study <span className="text-[var(--accent-coral)]">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Briefcase size={16} className="text-[var(--text-muted)]" />
                                        </div>
                                        <input
                                            type="text"
                                            value={domain}
                                            onChange={(e) => setDomain(e.target.value)}
                                            placeholder="e.g. Neuroscience, Abstract Algebra, Deep Learning"
                                            className="w-full bg-[#05070A] border border-[var(--border)] rounded-lg py-3 pl-10 pr-3 focus:ring-1 focus:ring-[var(--accent-mint)] focus:border-[var(--accent-mint)] outline-none transition-all text-[var(--text-primary)] text-[14px] placeholder-[var(--text-muted)]"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="group/input">
                                    <label className="block text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2 group-focus-within/input:text-[var(--accent-mint)] transition-colors flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-[var(--accent-violet)] group-focus-within/input:bg-[var(--accent-mint)] transition-colors"></div>
                                        Featured Publication URL
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <LinkIcon size={16} className="text-[var(--text-muted)]" />
                                        </div>
                                        <input
                                            type="url"
                                            value={researchPaper}
                                            onChange={(e) => setResearchPaper(e.target.value)}
                                            placeholder="e.g. https://arxiv.org/abs/..."
                                            className="w-full bg-[#05070A] border border-[var(--border)] rounded-lg py-3 pl-10 pr-3 focus:ring-1 focus:ring-[var(--accent-mint)] focus:border-[var(--accent-mint)] outline-none transition-all text-[var(--text-primary)] text-[14px] placeholder-[var(--text-muted)]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="group/input mb-6">
                                <label className="block text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2 group-focus-within/input:text-[var(--accent-mint)] transition-colors flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-[var(--accent-violet)] group-focus-within/input:bg-[var(--accent-mint)] transition-colors"></div>
                                    Professional Details <span className="text-[var(--accent-coral)]">*</span>
                                </label>
                                <textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    placeholder="Describe your current research focus, methodologies you use, and areas of interest. This helps AI agents assign you the perfect subtopic..."
                                    className="w-full bg-[#05070A] border border-[var(--border)] rounded-lg p-4 focus:ring-1 focus:ring-[var(--accent-mint)] focus:border-[var(--accent-mint)] outline-none transition-all text-[var(--text-primary)] text-[14px] placeholder-[var(--text-muted)] min-h-[120px] resize-y"
                                    required
                                />
                            </div>
                        </div>

                        {/* Section 3: Background */}
                        <div className="mb-10">
                            <h3 className="text-[12px] font-[var(--font-jetbrains)] uppercase tracking-[0.2em] text-[var(--text-muted)] mb-5 border-b border-[var(--border)] pb-2 flex items-center gap-2">
                                <BookOpen size={14} className="text-[var(--accent-violet)]" /> Background
                            </h3>
                            <div className="group/input">
                                <label className="block text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2 group-focus-within/input:text-[var(--accent-mint)] transition-colors flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-[var(--accent-violet)] group-focus-within/input:bg-[var(--accent-mint)] transition-colors"></div>
                                    Previous Research Experience
                                </label>
                                <textarea
                                    value={previousResearch}
                                    onChange={(e) => setPreviousResearch(e.target.value)}
                                    placeholder="List past projects, tools mastered, or earlier publications..."
                                    className="w-full bg-[#05070A] border border-[var(--border)] rounded-lg p-4 focus:ring-1 focus:ring-[var(--accent-mint)] focus:border-[var(--accent-mint)] outline-none transition-all text-[var(--text-primary)] text-[14px] placeholder-[var(--text-muted)] min-h-[120px] resize-y"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-5 pt-6 border-t border-[var(--border)] mt-8">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors bg-transparent border border-transparent hover:border-[var(--border)] rounded-md"
                            >
                                Discard Changes
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className={`px-8 py-3 bg-[var(--accent-mint)] text-[#0A0E17] rounded-md hover:bg-[#2ee8ab] font-bold font-[var(--font-syne)] text-sm transition-all hover:shadow-[0_0_20px_rgba(79,255,196,0.3)] hover:-translate-y-0.5 flex items-center gap-2 ${saving ? 'opacity-70 cursor-wait shadow-none hover:translate-y-0' : ''}`}
                            >
                                {saving ? (
                                    <><div className="w-4 h-4 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin"></div> Syncing Log...</>
                                ) : (
                                    <>Update Profile</>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Privacy Policy Footer */}
            <div className="pb-6 w-full text-center z-10 pointer-events-none mt-auto">
                <p className="text-[10px] font-[var(--font-jetbrains)] text-[var(--text-muted)] tracking-wider">
                    <span className="opacity-50">PRIVACY POLICY:</span> WE DO NOT UTILIZE PERSONAL INFO FOR TRAINING MODELS.
                </p>
            </div>
        </div>
    );
};

export default Profile;
