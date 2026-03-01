import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const AGENT_URL = 'http://localhost:8000';

const AgentChat = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Read project context stored by Home.jsx
    const projectId = localStorage.getItem('projectId') || '';
    const subtopicTitle = localStorage.getItem('subtopicTitle') || 'Research';
    const subtopicDescription = localStorage.getItem('subtopicDescription') || '';

    // Sidebar & Thread State
    const [threads, setThreads] = useState([]);
    const [currentThread, setCurrentThread] = useState(null);
    const [loadingThreads, setLoadingThreads] = useState(false);

    // Chat State
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Initial greeting if no messages exist
    const defaultGreeting = {
        sender: 'ai',
        text: `Hello ${user?.name || 'there'}! I'm your specialized AI research agent focused on **${subtopicTitle}**.\n\nAsk me anything related to your subtopic — I'm here to help you go deep! 🔬`
    };

    // Auto-scroll to bottom of chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 1. Fetch Threads on Mount
    useEffect(() => {
        const fetchThreads = async () => {
            if (!projectId || !user?._id) return;
            setLoadingThreads(true);
            try {
                const { data } = await axios.post(`${AGENT_URL}/threads`, {
                    project_id: projectId,
                    user_id: user._id
                });

                const loadedThreads = data.threads || [];
                setThreads(loadedThreads);

                if (loadedThreads.length > 0) {
                    // Load the most recent thread automatically
                    loadThreadHistory(loadedThreads[loadedThreads.length - 1].thread_id);
                } else {
                    setMessages([defaultGreeting]);
                }
            } catch (err) {
                console.error("Failed to load threads:", err);
            } finally {
                setLoadingThreads(false);
            }
        };

        fetchThreads();
        // eslint-disable-next-line
    }, [projectId, user]);

    // 2. Load History for a specific thread
    const loadThreadHistory = async (threadId) => {
        if (!threadId) return;
        setCurrentThread(threadId);
        setLoading(true);
        try {
            const { data } = await axios.get(`${AGENT_URL}/chat/history/${threadId}`);
            const history = data.history || [];

            if (history.length === 0) {
                setMessages([defaultGreeting]);
            } else {
                setMessages(history.map(m => ({
                    sender: m.role === 'user' ? 'user' : 'ai',
                    text: m.content
                })));
            }
        } catch (err) {
            console.error("Failed to load history:", err);
            setMessages([{ sender: 'ai', text: 'Error loading past messages.' }]);
        } finally {
            setLoading(false);
        }
    };

    // 3. Create a New Chat Thread
    const handleNewChat = async () => {
        if (!projectId || !user?._id) return;
        setLoading(true);
        try {
            const { data } = await axios.post(`${AGENT_URL}/chat/new`, {
                project_id: projectId,
                user_id: user._id
            });
            const newThreadId = data.thread_id;

            // Add to sidebar optimistically
            const newThreadObj = { thread_id: newThreadId, title: `Chat Setup ${threads.length + 1}` };
            setThreads(prev => [...prev, newThreadObj]);

            // Switch to it
            setCurrentThread(newThreadId);
            setMessages([defaultGreeting]);

        } catch (err) {
            console.error("Failed to create new chat:", err);
        } finally {
            setLoading(false);
        }
    };

    // 4. Send Message
    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = input.trim();
        setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
        setInput('');
        setLoading(true);

        try {
            const { data } = await axios.post(`${AGENT_URL}/chat`, {
                project_id: projectId,
                user_id: user?._id || 'anonymous',
                thread_id: currentThread,    // Send the specific thread ID
                message: userMsg
            });

            // If we didn't have a thread ID yet, the backend created one
            if (!currentThread && data.thread_id) {
                setCurrentThread(data.thread_id);
                // Refresh threads list implicitly
                setThreads(prev => {
                    if (!prev.find(t => t.thread_id === data.thread_id)) {
                        return [...prev, { thread_id: data.thread_id, title: "Initial Chat" }];
                    }
                    return prev;
                });
            }

            setMessages(prev => [...prev, { sender: 'ai', text: data.response }]);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">

            {/* Sidebar for Threads (Left) */}
            <div className="w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20 transition-all flex-shrink-0">
                {/* Brand / Title */}
                <div className="p-6 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white tracking-wide">LangGraph Chatbot</h2>
                </div>

                {/* New Chat Button */}
                <div className="p-4">
                    <button
                        onClick={handleNewChat}
                        disabled={loadingThreads}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 py-3 rounded-xl transition-all border border-slate-700 shadow-sm"
                    >
                        <span className="text-lg leading-none">+</span>
                        <span className="font-semibold text-sm">New Chat</span>
                    </button>
                </div>

                {/* List of Conversations */}
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3 px-2">My Conversations</h3>

                    {loadingThreads ? (
                        <div className="text-center py-6">
                            <span className="inline-block w-5 h-5 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin"></span>
                        </div>
                    ) : threads.length === 0 ? (
                        <p className="text-sm text-slate-500 px-2 italic text-center mt-4">No past conversations.</p>
                    ) : (
                        <div className="space-y-2">
                            {threads.map((t) => (
                                <button
                                    key={t.thread_id}
                                    onClick={() => loadThreadHistory(t.thread_id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors text-sm ${currentThread === t.thread_id
                                            ? 'bg-indigo-600 text-white font-medium shadow-md'
                                            : 'hover:bg-slate-800 text-slate-400'
                                        }`}
                                >
                                    <div className="truncate w-full">{t.thread_id.split('-')[0]}... ({t.title})</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Back to Home Button at bottom of sidebar */}
                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full text-sm font-semibold text-slate-400 hover:text-white transition-colors py-2"
                    >
                        ← Back to Project
                    </button>
                </div>
            </div>

            {/* Main Chat Area (Right) */}
            <div className="flex-1 flex flex-col relative w-full h-full">

                {/* Header for Main Chat Area */}
                <div className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 p-4 flex items-center gap-4 z-10 sticky top-0">
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            🤖 AI Research Agent
                        </h1>
                    </div>
                    {subtopicTitle && (
                        <span className="text-xs font-semibold bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full max-w-sm truncate shadow-sm">
                            Specializing in: {subtopicTitle}
                        </span>
                    )}
                </div>

                {/* No project warning */}
                {!projectId && (
                    <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3 text-sm text-yellow-800 flex items-center gap-2">
                        ⚠️ No research project assigned yet. Ask your team leader to launch a project first.
                    </div>
                )}

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-3xl mx-auto space-y-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0 mt-1 shadow-sm">
                                        AI
                                    </div>
                                )}
                                <div
                                    className={`max-w-[85%] px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${msg.sender === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-sm'
                                            : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold mr-3 flex-shrink-0 shadow-sm">
                                    AI
                                </div>
                                <div className="bg-white border border-gray-100 px-5 py-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div >

                {/* Input Area */}
                < div className="bg-white/80 backdrop-blur-md border-t border-gray-100 p-4 sticky bottom-0" >
                    <div className="max-w-4xl mx-auto relative">
                        <form onSubmit={handleSend} className="flex gap-3 items-end bg-gray-50 border border-gray-300 rounded-3xl p-1.5 shadow-inner transition-all focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:bg-white focus-within:border-indigo-400">
                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                                placeholder={`Ask about ${subtopicTitle}...`}
                                rows={1}
                                disabled={loading || !projectId}
                                className="flex-1 bg-transparent px-5 py-3.5 resize-none outline-none text-sm placeholder-gray-400 disabled:opacity-50"
                                style={{ maxHeight: '120px', overflowY: 'auto' }}
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim() || !projectId}
                                className={`p-3.5 rounded-full flex-shrink-0 transition-all ${!input.trim() || loading || !projectId
                                        ? 'bg-transparent text-gray-300 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 -translate-y-[2px]'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                                </svg>
                            </button>
                        </form>
                        <p className="absolute -bottom-5 w-full text-center text-[10px] text-gray-400 font-medium">
                            Press Return to Send • Shift+Return for New Line
                        </p>
                    </div >
                </div >
            </div >
        </div >
    );
};

export default AgentChat;
