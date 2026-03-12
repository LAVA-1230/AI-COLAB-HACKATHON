import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password);
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
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,_rgba(123,97,255,0.15)_0%,_rgba(0,0,0,0)_70%)] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none mix-blend-screen animate-pulse-slow"></div>
            <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(79,255,196,0.1)_0%,_rgba(0,0,0,0)_70%)] rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

            {/* 3D Floating Elements */}
            <div className="absolute top-20 right-20 w-32 h-32 bg-gradient-to-br from-[var(--accent-violet)] to-transparent rounded-full blur-3xl opacity-20 animate-float"></div>
            <div className="absolute bottom-20 left-20 w-40 h-40 bg-gradient-to-tr from-[var(--accent-mint)] to-transparent rounded-full blur-3xl opacity-20 animate-float" style={{ animationDelay: '-3s' }}></div>

            {/* Main Auth Container (3D Glassmorphism) */}
            <div className="w-full max-w-md p-10 relative z-10 transform-style-3d animate-fadeUp">

                {/* 3D Card Layers */}
                <div className="absolute inset-0 bg-[#0A0E17]/40 backdrop-blur-2xl border border-[rgba(255,255,255,0.05)] rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.1)] -z-10 translate-z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-violet)]/10 to-[var(--accent-mint)]/5 rounded-3xl -z-20 translate-z-0 blur-xl opacity-50"></div>

                <div className="text-center mb-10 translate-z-20">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-mint)] mb-6 shadow-[0_0_30px_rgba(123,97,255,0.4)] transform hover:rotate-12 transition-transform duration-500">
                        <Sparkles className="text-[#05070A]" size={32} />
                    </div>
                    <h2 className="text-4xl font-bold font-[var(--font-syne)] text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--text-muted)] tracking-tight">Access Hub</h2>
                    <p className="text-[12px] font-[var(--font-jetbrains)] text-[var(--accent-mint)] uppercase tracking-[0.2em] mt-3">Odyssey AI Protocol</p>
                </div>

                {error && (
                    <div className="p-4 mb-6 text-[13px] font-[var(--font-jetbrains)] text-[var(--accent-coral)] bg-[rgba(255,107,107,0.1)] border border-[rgba(255,107,107,0.3)] rounded-xl flex items-center gap-3 translate-z-20 shadow-[0_10px_20px_rgba(0,0,0,0.2)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-coral)] animate-pulse"></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 translate-z-30">
                    <div className="group">
                        <label className="block mb-2 text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] group-focus-within:text-[var(--accent-mint)] transition-colors">Neural Link (Email)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-mint)] transition-colors" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-[#05070A]/80 border border-[rgba(255,255,255,0.1)] rounded-xl focus:outline-none focus:border-[var(--accent-mint)] focus:ring-1 focus:ring-[var(--accent-mint)] transition-all text-[15px] placeholder-[var(--text-muted)] shadow-inner"
                                placeholder="researcher@odyssey.ai"
                                required
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block mb-2 text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-secondary)] group-focus-within:text-[var(--accent-violet)] transition-colors">Decryption Key (Password)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock size={16} className="text-[var(--text-muted)] group-focus-within:text-[var(--accent-violet)] transition-colors" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-[#05070A]/80 border border-[rgba(255,255,255,0.1)] rounded-xl focus:outline-none focus:border-[var(--accent-violet)] focus:ring-1 focus:ring-[var(--accent-violet)] transition-all text-[15px] placeholder-[var(--text-muted)] shadow-inner"
                                placeholder="••••••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="relative w-full py-4 font-bold font-[var(--font-syne)] text-[15px] text-[#0A0E17] bg-[var(--accent-mint)] hover:bg-[#2ee8ab] rounded-xl transition-all duration-300 transform hover:-translate-y-1 hover:shadow-[0_15px_30px_rgba(79,255,196,0.3)] flex items-center justify-center gap-3 group mt-8 overflow-hidden"
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-shimmer" />

                        {loading ? (
                            <><div className="w-5 h-5 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Authenticating...</>
                        ) : (
                            <>Initialize Interface <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>
                        )}
                    </button>
                </form>

                <div className="mt-10 text-center translate-z-20">
                    <p className="text-[12px] font-[var(--font-jetbrains)] text-[var(--text-muted)]">
                        New researcher?{' '}
                        <Link to="/signup" className="text-[var(--accent-mint)] hover:text-[var(--accent-violet)] transition-colors uppercase tracking-wider font-bold underline decoration-1 underline-offset-4">
                            Establish Profile
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

export default Login;
