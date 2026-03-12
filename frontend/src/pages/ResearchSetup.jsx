import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Rocket, FileText, Globe, ArrowRight, Brain, AlertTriangle } from 'lucide-react';

const ENDPOINT = 'http://localhost:5000';

const ResearchSetup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { roomId, teamName } = location.state || {};

    const [topic, setTopic] = useState('');
    const [status, setStatus] = useState('idle'); // idle | planning | error
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!topic.trim()) return;

        setStatus('planning');
        setErrorMsg('');

        try {
            const payload = { roomId, topic: topic.trim() };

            const { data } = await axios.post(
                `${ENDPOINT}/api/projects/create`,
                payload,
                { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
            );

            // Navigate back to the Home page with the new project
            navigate('/', { state: { roomId, project: data.project } });
        } catch (err) {
            console.error(err);
            setErrorMsg(err.response?.data?.message || 'Something went wrong while setting up the project.');
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] font-[var(--font-dm)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background ambient effects */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--accent-violet)] rounded-full mix-blend-screen filter blur-[150px] opacity-10 animate-pulse"></div>
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--accent-mint)] rounded-full mix-blend-screen filter blur-[150px] opacity-10 animate-pulse animation-delay-2000"></div>

            {/* Header Area */}
            <div className="w-full max-w-3xl mb-10 mt-10 text-center space-y-4 relative z-10 animate-fadeUp">
                <div className="inline-flex items-center justify-center p-4 bg-[rgba(123,97,255,0.1)] border border-[rgba(123,97,255,0.2)] rounded-2xl shadow-[0_0_30px_rgba(123,97,255,0.15)] mb-2">
                    <Rocket className="w-8 h-8 text-[var(--accent-violet)]" />
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold font-[var(--font-syne)] tracking-tight">
                    Launch Research Project
                </h1>
                {teamName && (
                    <p className="text-lg text-[var(--text-secondary)] font-medium">
                        for Team <span className="text-[var(--accent-mint)] font-[var(--font-jetbrains)]">{teamName}</span>
                    </p>
                )}
                <p className="text-[var(--text-muted)] max-w-xl mx-auto text-sm leading-relaxed">
                    Provide a core topic. Our LangGraph Planner will instantly divide the subject and deploy specialized AI Agents for each team member.
                </p>
            </div>

            {/* Main Form Card */}
            <div className="w-full max-w-3xl bg-[var(--bg-surface)]/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-[var(--border-bright)] overflow-hidden relative z-10 animate-fadeUp" style={{ animationDelay: '0.1s' }}>
                {status === 'planning' ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
                        <div className="relative w-28 h-28 mb-8 flex items-center justify-center">
                            {/* Inner spinning ring */}
                            <div className="absolute inset-0 border-[3px] border-[rgba(123,97,255,0.2)] border-t-[var(--accent-violet)] rounded-full animate-spin"></div>
                            {/* Outer pulsing ring */}
                            <div className="absolute inset-[-12px] border border-[rgba(79,255,196,0.3)] rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                            <Brain className="w-12 h-12 text-[var(--accent-violet)] animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-3">Architecting the Project...</h2>
                        <p className="text-[var(--text-secondary)] max-w-sm text-sm leading-relaxed">
                            The LangGraph Planner is currently analyzing your topic, generating sub-disciplines, and assigning specific knowledge vectors to your agents.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-8 sm:p-12 relative overflow-hidden">
                        {/* Subtle inner top glare */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.1)] to-transparent"></div>

                        {/* Topic Input Section */}
                        <div className="mb-10">
                            <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-3 uppercase tracking-[0.15em] font-[var(--font-jetbrains)] flex items-center gap-2">
                                <span className="text-[var(--accent-mint)] font-bold">01.</span> Primary Research Topic <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder="e.g. Applications of Quantum Machine Learning in Drug Discovery..."
                                    className="w-full bg-[#05070A]/50 border border-[rgba(255,255,255,0.08)] rounded-2xl px-5 py-5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-violet)] focus:border-[var(--accent-violet)] transition-all resize-none shadow-inner group-hover:border-[rgba(255,255,255,0.15)]"
                                    rows="4"
                                    required
                                />
                                <div className="absolute bottom-4 right-4 text-[10px] font-medium text-[var(--text-muted)] font-[var(--font-jetbrains)]">
                                    {topic.length}/200
                                </div>
                            </div>
                        </div>

                        {/* Future Additions Section */}
                        <div className="mb-10">
                            <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-3 uppercase tracking-[0.15em] font-[var(--font-jetbrains)] flex items-center gap-2">
                                <span className="text-[var(--text-muted)]">02.</span> Additional Context
                                <span className="text-[9px] bg-[rgba(123,97,255,0.1)] text-[var(--accent-violet)] border border-[rgba(123,97,255,0.2)] px-2 py-0.5 rounded font-bold uppercase tracking-wider ml-2">Future Release</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-50">
                                {/* PDF Upload Placeholder */}
                                <div className="border border-dashed border-[rgba(255,255,255,0.1)] rounded-2xl p-6 text-center bg-[#05070A]/30 cursor-not-allowed transition-colors hover:border-[rgba(255,255,255,0.2)]">
                                    <FileText className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-[var(--text-secondary)] font-[var(--font-syne)]">Upload PDF Docs</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1 font-[var(--font-dm)]">Provide papers or manuals</p>
                                </div>
                                {/* URL Scrape Placeholder */}
                                <div className="border border-dashed border-[rgba(255,255,255,0.1)] rounded-2xl p-6 text-center bg-[#05070A]/30 cursor-not-allowed transition-colors hover:border-[rgba(255,255,255,0.2)]">
                                    <Globe className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-[var(--text-secondary)] font-[var(--font-syne)]">Add Web URLs</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1 font-[var(--font-dm)]">Scrape articles & blogs</p>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {status === 'error' && errorMsg && (
                            <div className="mb-6 bg-[rgba(255,99,71,0.05)] border border-[rgba(255,99,71,0.2)] rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-[rgba(255,99,71,0.8)] shrink-0 mt-0.5" />
                                <p className="text-sm text-[rgba(255,150,130,0.9)] font-medium leading-relaxed">{errorMsg}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-[rgba(255,255,255,0.05)]">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="sm:w-1/3 py-4 rounded-xl bg-transparent border border-[var(--border-bright)] text-[var(--text-secondary)] font-bold hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors text-sm uppercase tracking-wider font-[var(--font-syne)]"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!topic.trim() || status === 'planning'}
                                className="sm:w-2/3 py-4 rounded-xl bg-[var(--accent-violet)] text-[#0A0E17] font-bold text-sm uppercase tracking-wider hover:bg-[#8f7aff] transition-all shadow-[0_0_20px_rgba(123,97,255,0.2)] hover:shadow-[0_0_30px_rgba(123,97,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 group font-[var(--font-syne)]"
                            >
                                Generate Action Plan
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Footer Help text */}
            <div className="mt-8 text-center text-[11px] text-[var(--text-muted)] max-w-md font-[var(--font-jetbrains)] opacity-70">
                <p>The system will automatically recognize the <strong className="text-[var(--text-secondary)]">{location.state?.memberCount || 'team members'}</strong> assigned to this room and divide the workload accordingly.</p>
            </div>
        </div>
    );
};

export default ResearchSetup;
