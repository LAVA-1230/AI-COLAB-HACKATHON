import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Mail, Lock, User, Shield, ArrowRight } from 'lucide-react';

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('student');
    const { signup } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await signup(name, email, password, role);
        setLoading(false);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] font-sans relative overflow-hidden text-[var(--text-primary)] perspective-1000">
            {/* Background 3D Objects & Gradients */}
            <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(79,255,196,0.15)_0%,_rgba(0,0,0,0)_70%)] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen animate-pulse-slow"></div>
            <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(123,97,255,0.1)_0%,_rgba(0,0,0,0)_70%)] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            {/* 3D Floating Elements */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-gradient-to-br from-[var(--accent-mint)] to-transparent rounded-full blur-3xl opacity-20 animate-float"></div>
            <div className="absolute bottom-20 right-20 w-40 h-40 bg-gradient-to-tr from-[var(--accent-violet)] to-transparent rounded-full blur-3xl opacity-20 animate-float" style={{ animationDelay: '-3s' }}></div>

            {/* Main Auth Container (3D Glassmorphism) */}
            <div className="w-full max-w-md p-10 relative z-10 transform-style-3d animate-fadeUp">

                {/* 3D Card Layers */}
                <div className="absolute inset-0 bg-[#0A0E17]/40 backdrop-blur-2xl border border-[rgba(255,255,255,0.05)] rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.1)] -z-10 translate-z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-bl from-[var(--accent-mint)]/10 to-[var(--accent-violet)]/5 rounded-3xl -z-20 translate-z-0 blur-xl opacity-50"></div>

                <div className="text-center mb-8 translate-z-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[var(--bg-surface)] border border-[rgba(79,255,196,0.2)] mb-5 shadow-[0_0_30px_rgba(79,255,196,0.1)] transform hover:-rotate-12 transition-transform duration-500">
                        <Sparkles className="text-[var(--accent-mint)]" size={28} />
                    </div>
                    <h2 className="text-3xl font-bold font-[var(--font-syne)] text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--text-muted)] tracking-tight">Establish Identity</h2>
                    <p className="text-[11px] font-[var(--font-jetbrains)] text-[var(--accent-violet)] uppercase tracking-[0.2em] mt-2">Join Odyssey Research</p>
                </div>

                {error && (
                    <div className="p-4 mb-6 text-[13px] font-[var(--font-jetbrains)] text-[var(--accent-coral)] bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.3)] rounded-xl flex items-center gap-3 translate-z-20 shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)] animate-pulse"></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 translate-z-30">
                    <div className="group">
                        <label className="block mb-2 text-[10px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] group-focus-within:text-[var(--accent-mint)] transition-colors">Full Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <User size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-mint)] transition-colors" />
                            </div>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-[#05070A]/80 border border-[rgba(255,255,255,0.1)] rounded-xl focus:outline-none focus:border-[var(--accent-mint)] focus:ring-1 focus:ring-[var(--accent-mint)] transition-all text-[14px] placeholder-[var(--text-muted)] shadow-inner"
                                placeholder="Dr. Jane Doe"
                                required
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block mb-2 text-[10px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] group-focus-within:text-[var(--accent-mint)] transition-colors">Neural Link (Email)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-mint)] transition-colors" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-[#05070A]/80 border border-[rgba(255,255,255,0.1)] rounded-xl focus:outline-none focus:border-[var(--accent-mint)] focus:ring-1 focus:ring-[var(--accent-mint)] transition-all text-[14px] placeholder-[var(--text-muted)] shadow-inner"
                                placeholder="researcher@odyssey.ai"
                                required
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block mb-2 text-[10px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] group-focus-within:text-[var(--accent-violet)] transition-colors">Decryption Key (Password)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-violet)] transition-colors" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-[#05070A]/80 border border-[rgba(255,255,255,0.1)] rounded-xl focus:outline-none focus:border-[var(--accent-violet)] focus:ring-1 focus:ring-[var(--accent-violet)] transition-all text-[14px] placeholder-[var(--text-muted)] shadow-inner"
                                placeholder="••••••••••••"
                                required
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block mb-2 text-[10px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] group-focus-within:text-[var(--accent-mint)] transition-colors">Authorization Level</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Shield size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-mint)] transition-colors" />
                            </div>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-[#05070A]/80 border border-[rgba(255,255,255,0.1)] rounded-xl focus:outline-none focus:border-[var(--accent-mint)] focus:ring-1 focus:ring-[var(--accent-mint)] transition-all text-[14px] text-[var(--text-primary)] appearance-none shadow-inner cursor-pointer"
                            >
                                <option value="student" className="bg-[#0A0E17]">Student / Researcher</option>
                                <option value="teacher" className="bg-[#0A0E17]">Teacher / Supervisor</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="relative w-full py-4 font-bold font-[var(--font-syne)] text-[14px] text-white bg-transparent border border-[var(--accent-mint)] hover:bg-[rgba(79,255,196,0.1)] rounded-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(79,255,196,0.1)] flex items-center justify-center gap-3 group mt-8 overflow-hidden"
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--accent-mint)]/20 to-transparent group-hover:animate-shimmer" />

                        {loading ? (
                            <><div className="w-4 h-4 border-2 border-[var(--accent-mint)] border-t-transparent rounded-full animate-spin" /> Registering...</>
                        ) : (
                            <>Initialize Protocol <ArrowRight size={16} className="text-[var(--accent-mint)] group-hover:translate-x-1 transition-transform" /></>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center translate-z-20">
                    <p className="text-[11px] font-[var(--font-jetbrains)] text-[var(--text-muted)]">
                        Already authorized?{' '}
                        <Link to="/login" className="text-[var(--accent-violet)] hover:text-[var(--accent-mint)] transition-colors uppercase tracking-wider font-bold underline decoration-1 underline-offset-4">
                            Access Hub
                        </Link>
                    </p>
                </div>
            </div>

            {/* Privacy Policy Footer */}
            <div className="absolute bottom-6 w-full text-center z-10 pointer-events-none">
                <p className="text-[10px] font-[var(--font-jetbrains)] text-[var(--text-muted)] tracking-wider opacity-60">
                    <span className="opacity-50">PRIVACY POLICY:</span> WE DO NOT UTILIZE PERSONAL INFO FOR TRAINING MODELS.
                </p>
            </div>
        </div>
    );
};

export default Signup;
