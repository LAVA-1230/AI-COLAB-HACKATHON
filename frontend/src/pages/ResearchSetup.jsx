import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

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
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Header Area */}
            <div className="w-full max-w-3xl mb-8 text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-4">
                    <span className="text-4xl">🚀</span>
                </div>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Launch Research Project</h1>
                {teamName && (
                    <p className="text-lg text-slate-500 font-medium">
                        for Team <span className="text-indigo-600 font-semibold">{teamName}</span>
                    </p>
                )}
                <p className="text-slate-500 max-w-xl mx-auto mt-4">
                    Provide a core topic below. Our AI Planner will automatically divide it into focused subtopics and assign a specialized AI Agent to each team member.
                </p>
            </div>

            {/* Main Form Card */}
            <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                {status === 'planning' ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                        <div className="relative w-24 h-24 mb-8">
                            {/* Inner spinning ring */}
                            <div className="absolute inset-0 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                            {/* Outer pulsing ring */}
                            <div className="absolute inset-[-8px] border border-indigo-100 rounded-full animate-ping"></div>
                            <span className="absolute inset-0 flex items-center justify-center text-3xl">🧠</span>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Architecting the Project...</h2>
                        <p className="text-slate-500 max-w-sm">
                            The LangGraph Planner is analyzing your topic and dividing it into unique subtopics for each team member.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-8 sm:p-10">
                        {/* Topic Input Section */}
                        <div className="mb-10">
                            <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                                1. Primary Research Topic <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    placeholder="e.g. Applications of Quantum Machine Learning in Drug Discovery..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none shadow-inner"
                                    rows="3"
                                    required
                                />
                                <div className="absolute bottom-4 right-4 text-xs font-medium text-slate-400">
                                    {topic.length}/200
                                </div>
                            </div>
                        </div>

                        {/* Future Additions Section (Visually distinct to show they are coming later) */}
                        <div className="mb-10 opacity-60">
                            <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                                2. Additional Context
                                <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* PDF Upload Placeholder */}
                                <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 cursor-not-allowed">
                                    <span className="text-2xl mb-2 block">📄</span>
                                    <p className="text-sm font-semibold text-slate-600">Upload PDF Docs</p>
                                    <p className="text-xs text-slate-400 mt-1">Provide papers or manuals</p>
                                </div>
                                {/* URL Scrape Placeholder */}
                                <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 cursor-not-allowed">
                                    <span className="text-2xl mb-2 block">🔗</span>
                                    <p className="text-sm font-semibold text-slate-600">Add Web URLs</p>
                                    <p className="text-xs text-slate-400 mt-1">Scrape articles & blogs</p>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {status === 'error' && errorMsg && (
                            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <span className="text-red-500 text-xl leading-none">⚠️</span>
                                <p className="text-sm text-red-700 font-medium mt-0.5">{errorMsg}</p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="sm:w-1/3 py-3.5 rounded-xl bg-white border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!topic.trim() || status === 'planning'}
                                className="sm:w-2/3 py-3.5 rounded-xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                            >
                                Generate Action Plan
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Footer Help text */}
            <div className="mt-8 text-center text-sm text-slate-400 max-w-md">
                <p>The system will automatically recognize the <strong>{location.state?.memberCount || 'team members'}</strong> assigned to this room and divide the workload accordingly.</p>
            </div>
        </div>
    );
};

export default ResearchSetup;
