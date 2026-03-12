import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import mermaid from 'mermaid';
import { ArrowLeft, Plus, MessageSquare, Bot, Send, Paperclip, Sparkles, AlertCircle, Target } from 'lucide-react';

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: '"DM Sans", sans-serif',
});

// Helper component to render Mermaid SVGs securely and without flicker
const MermaidChart = memo(({ chart }) => {
    const [svgContent, setSvgContent] = useState('');
    // Ensure the ID stays stable across re-renders of the same chart component
    const id = useMemo(() => `mermaid-${Math.random().toString(36).substr(2, 9)}`, []);

    useEffect(() => {
        let isMounted = true;

        // Prevent empty charts from triggering errors
        if (!chart || chart.trim() === '') return;

        const renderChart = async () => {
            try {
                // mermaid.render returns { svg }
                const { svg } = await mermaid.render(id, chart);
                if (isMounted) setSvgContent(svg);
            } catch (err) {
                console.error("Mermaid parsing error:", err);
                if (isMounted) setSvgContent(`<div class="text-[var(--accent-coral)] text-xs mt-2 border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] p-3 rounded-lg font-[var(--font-jetbrains)] flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Failed to render flowchart. Syntax error.</div>`);
            }
        };
        renderChart();
        return () => { isMounted = false; };
    }, [chart, id]);

    return (
        <div
            className="my-5 overflow-x-auto bg-[#0A0E17] border border-[var(--border)] p-5 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] w-full max-w-full min-h-[150px] flex justify-center items-center [&>svg]:max-w-full [&>svg]:h-auto custom-scrollbar"
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
});

const AGENT_URL = 'http://localhost:8000';

const AgentChat = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Read project context stored by Home.jsx
    const projectId = localStorage.getItem('projectId') || '';
    const subtopicTitle = localStorage.getItem('subtopicTitle') || 'Research';
    const subtopicDescription = localStorage.getItem('subtopicDescription') || '';
    const isSupervisor = localStorage.getItem('isSupervisor') === 'true';
    const teamName = localStorage.getItem('teamName') || 'Research Team';

    // Sidebar & Thread State
    const [threads, setThreads] = useState([]);
    const [currentThread, setCurrentThread] = useState(null);
    const [loadingThreads, setLoadingThreads] = useState(false);

    // Chat State
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploadingPdf, setUploadingPdf] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // Initial greeting if no messages exist
    const defaultGreeting = {
        sender: 'ai',
        text: isSupervisor
            ? `Welcome, **${teamName}** team! 👋\n\nI'm the **Project Supervisor Agent** overseeing your entire research project across all subtopics.\n\nAny team member can chat here — messages are shared with the whole team. Ask me about project status, cross-topic insights, or coordination! 🧭`
            : `Hello ${user?.name || 'there'}! I'm your specialized AI research agent focused on **${subtopicTitle}**.\n\nAsk me anything related to your subtopic — I'm here to help you go deep! 🔬`
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
                    user_id: user._id,
                    is_supervisor: isSupervisor
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
    }, [projectId, user, isSupervisor]);

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
                user_id: user._id,
                is_supervisor: isSupervisor
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
            const endpoint = isSupervisor ? `${AGENT_URL}/chat/supervisor` : `${AGENT_URL}/chat`;
            const { data } = await axios.post(endpoint, {
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

    // 5. Handle PDF Upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !projectId || !user?._id) return;

        // Ensure we have a thread to attach this to
        let activeThread = currentThread;
        if (!activeThread) {
            setUploadingPdf(true);
            try {
                const { data } = await axios.post(`${AGENT_URL}/chat/new`, {
                    project_id: projectId,
                    user_id: user._id
                });
                activeThread = data.thread_id;
                setCurrentThread(activeThread);
                setThreads(prev => [...prev, { thread_id: activeThread, title: "Initial Chat with PDF" }]);
            } catch (err) {
                console.error("Failed to create thread for PDF:", err);
                setUploadingPdf(false);
                return;
            }
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('project_id', projectId);
        formData.append('user_id', user._id);
        formData.append('thread_id', activeThread);

        setUploadingPdf(true);
        // Optimistic UI for the user
        setMessages(prev => [...prev, {
            sender: 'user',
            text: `📄 Uploaded document: **${file.name}**`
        }]);

        try {
            const { data } = await axios.post(`${AGENT_URL}/chat/pdf`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Server responds with the injected system message info, we can display a success AI message
            setMessages(prev => [...prev, {
                sender: 'ai',
                text: `✅ I have successfully read and memorized **${file.name}**. I found and embedded ${data.sections?.length || 0} major sections into my knowledge base using LlamaParse and ChromaDB. You can now ask me questions about it!`
            }]);

        } catch (err) {
            console.error("PDF Upload Error:", err);
            setMessages(prev => [...prev, {
                sender: 'ai',
                text: `❌ Failed to process the PDF: ${err.response?.data?.detail || err.message}`
            }]);
        } finally {
            setUploadingPdf(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // reset
        }
    };

    return (
        <div className="flex bg-[var(--bg-primary)] h-screen overflow-hidden text-[var(--text-primary)]">
            <div className="w-[300px] bg-[#080C14] flex flex-col border-r border-[var(--border-bright)] shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-20 transition-all flex-shrink-0">
                {/* Brand / Title */}
                <div className="p-6 border-b border-[var(--border)]">
                    <h2 className="text-xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] tracking-wide flex items-center gap-2 mb-1">
                        <Sparkles className="text-[var(--accent-mint)]" size={18} /> Odyssey AI
                    </h2>
                    <p className="text-[10px] font-[var(--font-jetbrains)] uppercase tracking-widest text-[var(--text-muted)]">Research Interface</p>
                </div>

                <div className="p-5">
                    <button
                        onClick={handleNewChat}
                        disabled={loadingThreads}
                        className="w-full flex items-center justify-center gap-2 bg-transparent border border-[var(--border-bright)] hover:border-[var(--accent-mint)] text-[var(--text-secondary)] hover:text-[var(--accent-mint)] py-3 rounded-lg transition-all font-bold font-[var(--font-syne)] text-sm group"
                    >
                        <Plus className="group-hover:rotate-90 transition-transform" size={16} />
                        New Chat
                    </button>
                </div>

                {/* List of Conversations */}
                <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
                    <h3 className="text-[10px] font-bold font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-muted)] mb-3 px-3">My Conversations</h3>

                    {loadingThreads ? (
                        <div className="text-center py-8">
                            <span className="inline-block w-5 h-5 border-2 border-[var(--border-bright)] border-t-[var(--accent-mint)] rounded-full animate-spin"></span>
                        </div>
                    ) : threads.length === 0 ? (
                        <p className="text-[12px] text-[var(--text-muted)] px-3 italic text-center mt-6 py-8 border border-[var(--border)] border-dashed rounded-lg bg-[var(--bg-surface)]">No past conversations.</p>
                    ) : (
                        <div className="space-y-1">
                            {threads.map((t) => (
                                <button
                                    key={t.thread_id}
                                    onClick={() => loadThreadHistory(t.thread_id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-all text-[13px] flex items-center gap-3 group ${currentThread === t.thread_id
                                        ? 'bg-[rgba(79,255,196,0.1)] text-[var(--accent-mint)] border border-[rgba(79,255,196,0.2)]'
                                        : 'hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                                        }`}
                                >
                                    <MessageSquare size={14} className={currentThread === t.thread_id ? 'text-[var(--accent-mint)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'} />
                                    <div className="truncate w-full font-medium font-[var(--font-dm-sans)]">
                                        <span className="opacity-50 mr-2 text-[10px] font-[var(--font-jetbrains)] uppercase">{t.thread_id.split('-')[0]}</span>
                                        {t.title}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Back to Home Button at bottom of sidebar */}
                <div className="p-4 border-t border-[var(--border)] bg-[#0A0E17]">
                    <button
                        onClick={() => navigate('/')}
                        className="w-full text-xs font-bold font-[var(--font-jetbrains)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-3 flex items-center justify-center gap-2 uppercase tracking-wider rounded border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-surface)]"
                    >
                        <ArrowLeft size={14} /> Back to Project
                    </button>
                </div>
            </div>

            {/* Main Chat Area (Right) */}
            <div className="flex-1 flex flex-col relative w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131B2A] via-[#0A0E17] to-[#05070A]">

                {/* Header for Main Chat Area */}
                <div className="bg-[var(--bg-primary)]/80 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-[var(--border)] px-8 py-5 flex items-center justify-between z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-mint)] flex items-center justify-center shadow-[0_0_15px_rgba(79,255,196,0.3)]">
                            <Bot className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold font-[var(--font-syne)] text-[var(--text-primary)] flex items-center gap-2">
                                {isSupervisor ? 'Project Supervisor' : 'Research Assistant'}
                            </h1>
                            <p className="text-[11px] font-[var(--font-jetbrains)] text-[var(--accent-mint)] flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-mint)] animate-pulse-dot"></span> Online and Ready
                            </p>
                        </div>
                    </div>
                    {subtopicTitle && (
                        <span className="text-[11px] font-bold font-[var(--font-jetbrains)] uppercase tracking-widest bg-[rgba(123,97,255,0.1)] border border-[rgba(123,97,255,0.3)] text-[var(--accent-violet)] px-4 py-1.5 rounded flex items-center gap-2 shadow-[0_0_10px_rgba(123,97,255,0.1)]">
                            <Target size={12} /> {subtopicTitle}
                        </span>
                    )}
                </div>

                {/* No project warning */}
                {!projectId && (
                    <div className="bg-[rgba(255,179,71,0.1)] border-b border-[rgba(255,179,71,0.3)] px-8 py-4 text-sm text-[var(--accent-amber)] flex items-center gap-3 font-medium">
                        <AlertCircle size={18} /> No research project assigned yet. Ask your team leader to launch a project first.
                    </div>
                )}

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-mint)] mr-4 flex-shrink-0 mt-1 shadow-[0_0_15px_rgba(79,255,196,0.1)]">
                                        <Bot size={16} />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[95%] md:max-w-[85%] px-6 py-4 text-[14px] leading-relaxed overflow-x-hidden ${msg.sender === 'user'
                                        ? 'bg-[var(--accent-mint)] text-[#0A0E17] rounded-tl-xl rounded-tr-xl rounded-bl-xl font-medium'
                                        : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-tr-xl rounded-br-xl rounded-bl-xl prose prose-invert prose-sm max-w-none prose-a:text-[var(--accent-mint)] prose-a:no-underline hover:prose-a:underline prose-code:text-[var(--accent-violet)] prose-headings:font-[var(--font-syne)] prose-headings:text-[var(--text-primary)]'
                                        }`}
                                >
                                    {msg.sender === 'user' ? (
                                        <div className="whitespace-pre-wrap">{msg.text}</div>
                                    ) : (
                                        <ReactMarkdown
                                            rehypePlugins={[[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]]}
                                            components={{
                                                code({ node, inline, className, children, ...props }) {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    if (!inline && match && match[1] === 'mermaid') {
                                                        return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
                                                    }
                                                    return (
                                                        <code className={`${className} bg-[#0A0E17] text-[var(--accent-mint)] px-1.5 py-0.5 rounded text-[12px] font-[var(--font-jetbrains)] border border-[var(--border)]`} {...props}>
                                                            {children}
                                                        </code>
                                                    );
                                                }
                                            }}
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-violet)] mr-4 flex-shrink-0 mt-1 shadow-[0_0_15px_rgba(123,97,255,0.1)]">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-[var(--bg-surface)] border border-[var(--border)] px-6 py-5 rounded-tr-xl rounded-br-xl rounded-bl-xl flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[var(--accent-violet)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-[var(--accent-violet)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-[var(--accent-violet)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}

                        {uploadingPdf && (
                            <div className="flex justify-start">
                                <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-violet)] mr-4 flex-shrink-0 mt-1 shadow-[0_0_15px_rgba(123,97,255,0.1)]">
                                    <Bot size={16} />
                                </div>
                                <div className="bg-[var(--bg-surface)] border border-[var(--border)] px-6 py-4 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm text-[var(--text-secondary)] flex items-center gap-3">
                                    <div className="w-4 h-4 border-2 border-[var(--accent-violet)] border-t-transparent rounded-full animate-spin" />
                                    Parsing PDF sections with LlamaParse...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="bg-[var(--bg-primary)]/80 backdrop-blur-xl border-t border-[var(--border)] p-6 sticky bottom-0 z-20">
                    <div className="max-w-4xl mx-auto relative">
                        <form onSubmit={handleSend} className="flex gap-3 items-end bg-[#080C14] border border-[var(--border)] rounded-2xl p-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all focus-within:border-[var(--accent-mint)] focus-within:ring-1 focus-within:ring-[var(--accent-mint)]">

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                accept=".pdf"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                            />

                            {/* Paperclip Button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading || uploadingPdf || !projectId}
                                className={`p-4 rounded-xl flex-shrink-0 transition-all ml-1 ${loading || uploadingPdf || !projectId
                                    ? 'text-[var(--text-muted)] cursor-not-allowed opacity-50'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--accent-violet)] hover:bg-[rgba(123,97,255,0.1)]'
                                    }`}
                                title="Upload PDF for RAG"
                            >
                                <Paperclip size={20} />
                            </button>

                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                                placeholder={`Ask about ${subtopicTitle}...`}
                                rows={1}
                                disabled={loading || uploadingPdf || !projectId}
                                className="flex-1 bg-transparent px-3 py-4 resize-none outline-none text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] disabled:opacity-50 min-h-[56px]"
                                style={{ maxHeight: '150px', overflowY: 'auto' }}
                            />
                            <button
                                type="submit"
                                disabled={loading || uploadingPdf || !input.trim() || !projectId}
                                className={`p-4 rounded-xl flex-shrink-0 transition-all mr-1 ${!input.trim() || loading || uploadingPdf || !projectId
                                    ? 'bg-transparent text-[var(--text-muted)] cursor-not-allowed border border-transparent'
                                    : 'bg-[var(--accent-mint)] text-[#0A0E17] hover:bg-[#2ee8ab] shadow-[0_0_20px_rgba(79,255,196,0.3)] hover:scale-105'
                                    }`}
                            >
                                <Send size={20} className={(!input.trim() || loading || uploadingPdf || !projectId) ? '' : 'translate-x-0.5 -translate-y-0.5'} />
                            </button>
                        </form>
                        <p className="absolute -bottom-5 w-full text-center text-[10px] text-[var(--text-muted)] font-[var(--font-jetbrains)] tracking-widest uppercase">
                            Press Enter to Send • Shift+Enter for New Line
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AgentChat;
