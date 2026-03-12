import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { LogOut, Plus, LogIn, ChevronRight, Activity, Users, Trophy, Target, Sparkles, ArrowRight, BookOpen, MessageSquare, Send } from 'lucide-react';

const ENDPOINT = "http://localhost:5000";

const Home = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [showJoinRoom, setShowJoinRoom] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState('');
    const [createTeamName, setCreateTeamName] = useState('');
    const [createdRoomCode, setCreatedRoomCode] = useState(null);
    const [project, setProject] = useState(null);
    const [loadingProject, setLoadingProject] = useState(false);
    const [expandedSubtopic, setExpandedSubtopic] = useState(null);

    // Insights Modal State
    const [showInsightsModal, setShowInsightsModal] = useState(false);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [insightsData, setInsightsData] = useState([]); // [{heading, content}]
    const [evaluatingInsights, setEvaluatingInsights] = useState(false);
    const [evalFeedback, setEvalFeedback] = useState(null);

    // Late Joiner State
    const [assigningSubtopic, setAssigningSubtopic] = useState(false);

    // Clusters State
    const [showClustersModal, setShowClustersModal] = useState(false);
    const [clusterData, setClusterData] = useState(null);
    const [loadingClusters, setLoadingClusters] = useState(false);

    const handleViewClusters = async () => {
        if (!project?._id) return;
        setLoadingClusters(true);

        // Count completed papers from the project data (isRead === true)
        const completedCount = project.subtopics?.reduce((acc, sub) => {
            return acc + (sub.savedPapers?.filter(p => p.isRead)?.length || 0);
        }, 0) || 0;

        try {
            const { data } = await axios.post(`${ENDPOINT}/api/projects/${project._id}/clusters`);
            // Override count with the real one from MongoDB
            setClusterData({ ...data, count: completedCount });
            setShowClustersModal(true);
        } catch (err) {
            // Show modal with a friendly message instead of an error alert
            setClusterData({
                ready: false,
                message: "Complete more research papers to view new research insights.",
                count: completedCount
            });
            setShowClustersModal(true);
        } finally {
            setLoadingClusters(false);
        }
    };

    // Profile Form Modal State
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileDomain, setProfileDomain] = useState('');
    const [profileMethodologies, setProfileMethodologies] = useState([]);
    const [profileExperience, setProfileExperience] = useState('');
    const [profileResearchPaper, setProfileResearchPaper] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    const methodologyOptions = [
        'Implementation',
        'Literature Review',
        'Experiment Design',
        'Benchmark Evaluation',
        'Writing and Synthesis'
    ];

    const toggleMethodology = (m) => {
        setProfileMethodologies(prev =>
            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
        );
    };

    const showProfileForm = async () => {
        // Pre-fill with existing profile data if it exists
        try {
            const { data } = await axios.get(`${ENDPOINT}/api/user-details`);
            if (data && data.domain) {
                setProfileDomain(data.domain || '');
                setProfileMethodologies(data.details ? data.details.split(', ').filter(Boolean) : []);
                setProfileExperience(data.previousResearch || '');
                setProfileResearchPaper(data.researchPaper || '');
            }
        } catch {
            // No existing profile, start fresh
        }
        setShowProfileModal(true);
    };

    const handleProfileSave = async () => {
        if (!profileDomain.trim()) return alert('Please enter your domain expertise.');
        setSavingProfile(true);
        try {
            await axios.post(`${ENDPOINT}/api/user-details`, {
                domain: profileDomain,
                details: profileMethodologies.join(', '),
                previousResearch: profileExperience,
                researchPaper: profileResearchPaper
            });
            setShowProfileModal(false);
        } catch (err) {
            alert('Failed to save profile. Please try again.');
        } finally {
            setSavingProfile(false);
        }
    };

    useEffect(() => { fetchRooms(); }, [user]);

    // if navigated with data in location state, auto-select and/or use project
    useEffect(() => {
        const roomId = location.state?.roomId;
        const projectFromNav = location.state?.project;
        if (projectFromNav) {
            setProject(projectFromNav);
        }
        if (roomId) {
            // if we already have project from nav, we may still want to refresh room info
            fetchRoomDetails(roomId);
        }
        // clear state so subsequent navigations don't repeat
        if (roomId || projectFromNav) {
            navigate('.', { replace: true, state: {} });
        }
    }, [location.state]);

    const fetchRooms = async () => {
        if (!user) return;
        try {
            const { data } = await axios.get(`${ENDPOINT}/api/rooms/my-rooms`);
            setRooms(data);
        } catch { }
    };

    const fetchRoomDetails = async (roomId) => {
        try {
            const { data } = await axios.get(`${ENDPOINT}/api/rooms/${roomId}`);
            setSelectedRoom(data);
            fetchProject(data.roomId);
        } catch { }
    };

    const fetchProject = async (roomId) => {
        setLoadingProject(true);
        try {
            const { data } = await axios.get(`${ENDPOINT}/api/projects/${roomId}`);
            setProject(data);
        } catch {
            setProject(null); // No project yet
        } finally {
            setLoadingProject(false);
        }
    };

    const togglePaperRead = async (paperId) => {
        // Find paper
        let paper = null;
        for (const subtopic of project.subtopics) {
            const p = subtopic.savedPapers?.find(x => x._id === paperId);
            if (p) { paper = p; break; }
        }
        if (!paper) return;

        if (!paper.isRead) {
            // Open modal to submit insights instead of instantly toggling
            setSelectedPaper(paper);

            const initialInsights = (paper.headings && paper.headings.length > 0)
                ? paper.headings.map(h => ({ heading: h, content: '' }))
                : [{ heading: 'Overall Insights', content: '' }];

            setInsightsData(initialInsights);
            setEvalFeedback(null);
            setShowInsightsModal(true);
            return;
        }

        // Un-reading (revert logic)
        try {
            setProject(prev => {
                const newProject = { ...prev };
                for (const subtopic of newProject.subtopics) {
                    const paperIndex = subtopic.savedPapers?.findIndex(p => p._id === paperId);
                    if (paperIndex !== undefined && paperIndex !== -1) {
                        subtopic.savedPapers[paperIndex].isRead = false;
                        break;
                    }
                }
                return newProject;
            });

            await axios.put(`${ENDPOINT}/api/projects/${project._id}/papers/${paperId}/read`, {}, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
        } catch (err) {
            console.error("Failed to untoggle read", err);
            fetchProject(project.roomId);
        }
    };

    const submitInsights = async () => {
        setEvaluatingInsights(true);
        setEvalFeedback(null);
        try {
            const { data } = await axios.post(`${ENDPOINT}/api/projects/${project._id}/papers/${selectedPaper._id}/insights`, {
                insights: insightsData
            }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            setEvalFeedback(`Success! Awarded ${data.points} points. Feedback: ${data.feedback}`);

            // Wait 2.5 seconds to read feedback before closing
            setTimeout(() => {
                setShowInsightsModal(false);
                setSelectedPaper(null);
                setEvalFeedback(null);
                fetchProject(project.roomId); // refresh project to get updated subtopic points and read status
            }, 2500);

        } catch (err) {
            console.error("Failed to submit insights", err);
            setEvalFeedback("Error evaluating insights. Please try again.");
        } finally {
            setEvaluatingInsights(false);
        }
    };

    const handleAssignSubtopic = async () => {
        setAssigningSubtopic(true);
        try {
            await axios.post(`${ENDPOINT}/api/projects/${project._id}/assign-late-joiner`, {}, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            fetchProject(project.roomId); // Refresh to get the new subtopic
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || "Failed to assign subtopic.");
        } finally {
            setAssigningSubtopic(false);
        }
    };

    const submitSubtopicFeedback = async (subtopicId, feedback) => {
        try {
            await axios.post(`${ENDPOINT}/api/projects/${project._id}/subtopics/${subtopicId}/feedback`, { feedback }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            fetchProject(project.roomId);
        } catch (err) {
            alert("Failed to save subtopic feedback");
        }
    };

    const submitPaperFeedback = async (paperId, feedback) => {
        try {
            await axios.post(`${ENDPOINT}/api/projects/${project._id}/papers/${paperId}/feedback`, { feedback }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            fetchProject(project.roomId);
        } catch (err) {
            alert("Failed to save paper feedback");
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post(`${ENDPOINT}/api/rooms/create`, { teamName: createTeamName });
            setRooms([...rooms, data]);
            setCreatedRoomCode(data.roomId);
            setShowCreateRoom(false);
            setCreateTeamName('');
            showProfileForm();
        } catch { alert("Failed to create room"); }
    };

    const handleJoinRoom = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post(`${ENDPOINT}/api/rooms/join`, { roomId: joinRoomId });
            if (!rooms.find(r => r._id === data._id)) setRooms([...rooms, data]);
            setShowJoinRoom(false);
            setJoinRoomId('');
            fetchRoomDetails(data.roomId);
            showProfileForm();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to join room");
        }
    };

    const isCreator = selectedRoom && user && selectedRoom.creator === user._id;
    const mySubtopic = project?.subtopics?.find(s => s.assignedUserId === user?._id);

    const statusColors = {
        ingesting: 'bg-yellow-100 text-yellow-800',
        planning: 'bg-blue-100 text-blue-800',
        active: 'bg-green-100 text-green-800',
        done: 'bg-green-100 text-green-800',
        error: 'bg-red-100 text-red-800',
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)] bg-radial bg-pattern text-[var(--text-primary)] font-[var(--font-dm-sans)]">
            {/* Sidebar */}
            <div className="w-64 bg-[#080C14] border-r border-[var(--border)] flex flex-col shadow-2xl z-10 relative">
                <div className="p-5 border-b border-[var(--border)] flex flex-col justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-mint)] shadow-[0_0_8px_var(--accent-mint)]"></div>
                        <h2 className="text-xl font-bold font-[var(--font-syne)] text-[var(--text-primary)]">Odyssey</h2>
                    </div>

                    <div className="flex items-center gap-4 w-full">
                        <button onClick={() => navigate('/profile')} className="text-xs font-semibold text-[var(--accent-mint)] hover:text-[#2ee8ab] transition-colors">Profile</button>
                        <button onClick={logout} className="text-xs font-semibold text-[var(--accent-coral)] hover:text-[#ff4f4f] transition-colors">Logout</button>
                    </div>
                </div>

                <div className="px-5 pt-6 pb-2">
                    <h3 className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold">My Teams</h3>
                </div>

                <div className="flex-1 overflow-y-auto px-3">
                    {rooms.length === 0 ? (
                        <p className="px-2 py-4 text-[var(--text-muted)] text-sm italic">No teams joined yet.</p>
                    ) : rooms.map((room, idx) => (
                        <div
                            key={room._id}
                            onClick={() => {
                                fetchRoomDetails(room.roomId);
                                setCreatedRoomCode(null);
                                setShowJoinRoom(false);
                                setShowCreateRoom(false);
                            }}
                            className={`px-3 py-3 my-1 cursor-pointer rounded transition-all duration-150 animate-fadeUp flex flex-col gap-1
                                ${selectedRoom?._id === room._id
                                    ? 'bg-[rgba(79,255,196,0.05)] border-l-2 border-[var(--accent-mint)] pl-[10px]'
                                    : 'border-l-2 border-transparent hover:border-[var(--accent-mint)] hover:bg-[rgba(255,255,255,0.02)]'}`}
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            <p className={`font-semibold font-[var(--font-syne)] text-[14px] truncate ${selectedRoom?._id === room._id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {room.teamName}
                            </p>
                            <p className="text-[11px] font-[var(--font-jetbrains)] text-[var(--text-muted)]">ID: {room.roomId}</p>
                        </div>
                    ))}
                </div>

                {/* Current User Badge in Sidebar */}
                <div className="px-4 py-3 border-t border-[var(--border)] bg-[#060A12]">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-mint)] flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">{user?.name?.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{user?.name}</p>
                            <p className="text-[10px] text-[var(--text-muted)] font-[var(--font-jetbrains)]">{user?.role || 'student'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-y-auto relative">
                {!selectedRoom ? (
                    <div className="flex-1 flex flex-col items-start justify-center p-16 max-w-5xl animate-fadeUp">
                        {/* Time-based greeting */}
                        <h1 className="text-5xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-3 tracking-tight">
                            Good {new Date().getHours() < 5 || new Date().getHours() >= 18 ? 'evening' : new Date().getHours() < 12 ? 'morning' : 'afternoon'}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-mint)] to-[var(--accent-violet)]">{user?.name?.split(' ')[0]}</span>.
                        </h1>
                        <p className="text-[var(--text-secondary)] text-lg mb-8 max-w-2xl leading-relaxed">Your research teams are ready.</p>

                        <div className="flex items-center space-x-4 mb-12 text-[var(--text-muted)] font-[var(--font-jetbrains)] text-xs bg-[var(--bg-elevated)] px-4 py-2 rounded-md border border-[var(--border)]">
                            <span className="flex items-center gap-2"><Users size={14} className="text-[var(--accent-mint)]" /> {rooms.length} Teams</span>
                            <span>•</span>
                            <span className="flex items-center gap-2"><Target size={14} className="text-[var(--accent-violet)]" /> {rooms.length > 0 ? 'Active' : 'Standby'}</span>
                        </div>

                        {createdRoomCode ? (
                            <div className="bg-[var(--bg-surface)] p-8 rounded-xl border border-[var(--accent-mint)] text-left max-w-md w-full mb-8 shadow-[0_8px_32px_rgba(79,255,196,0.1)] animate-fadeUp">
                                <h3 className="text-2xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-2 flex items-center gap-2"><Sparkles className="text-[var(--accent-mint)]" size={24} /> Team Created</h3>
                                <p className="text-[var(--text-secondary)] mb-6 text-sm">Share this code with your teammates to invite them.</p>
                                <div className="text-3xl font-[var(--font-jetbrains)] tracking-widest font-bold bg-[#0A0E17] py-4 px-6 rounded-lg border border-[var(--border-bright)] select-all text-[var(--accent-mint)] text-center mb-6">{createdRoomCode}</div>
                                <button onClick={() => setCreatedRoomCode(null)} className="text-[var(--text-primary)] bg-[var(--bg-elevated)] hover:bg-[var(--border-bright)] transition-colors px-6 py-2 rounded-md font-semibold text-sm w-full">Done</button>
                            </div>
                        ) : (
                            <div className="flex space-x-5 items-start">
                                {/* Create Room Button / Form */}
                                {!showCreateRoom ? (
                                    <button onClick={() => { setShowCreateRoom(true); setShowJoinRoom(false); }} className="px-7 py-3 bg-[var(--accent-mint)] text-[#0A0E17] border border-transparent rounded-md hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(79,255,196,0.3)] transition-all font-[var(--font-syne)] font-bold text-base flex flex-col items-start min-w-[200px] h-[100px] justify-between group">
                                        <Plus size={24} className="mb-2 text-[#0A0E17] transition-transform group-hover:rotate-90" />
                                        <span>Create Team</span>
                                    </button>
                                ) : (
                                    <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-bright)] shadow-2xl w-full max-w-sm animate-fadeUp">
                                        <h3 className="text-lg font-bold font-[var(--font-syne)] mb-4 text-[var(--text-primary)] flex items-center gap-2"><Plus size={18} className="text-[var(--accent-mint)]" /> Create New Team</h3>
                                        <form onSubmit={handleCreateRoom}>
                                            <input type="text" placeholder="Enter Team Name" value={createTeamName} onChange={e => setCreateTeamName(e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] p-3 rounded-md mb-5 focus:outline-none focus:border-[var(--accent-mint)] transition-colors" required />
                                            <div className="flex gap-3">
                                                <button type="button" onClick={() => setShowCreateRoom(false)} className="flex-1 py-2.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors text-sm font-semibold">Cancel</button>
                                                <button type="submit" className="flex-1 py-2.5 bg-[var(--accent-mint)] text-[#0A0E17] rounded-md hover:bg-[#2ee8ab] transition-colors font-[var(--font-syne)] font-bold">Create</button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {/* Join Room Button / Form */}
                                {!showJoinRoom ? (
                                    <button onClick={() => { setShowJoinRoom(true); setShowCreateRoom(false); }} className="px-7 py-3 bg-transparent text-[var(--text-secondary)] border border-[var(--border-bright)] rounded-md hover:scale-[1.02] hover:border-[var(--accent-mint)] hover:text-[var(--accent-mint)] transition-all font-[var(--font-syne)] font-bold text-base flex flex-col items-start min-w-[200px] h-[100px] justify-between group">
                                        <LogIn size={24} className="mb-2 transition-transform group-hover:translate-x-1" />
                                        <span>Join Team</span>
                                    </button>
                                ) : (
                                    <div className="bg-[var(--bg-surface)] p-6 rounded-xl border border-[var(--border-bright)] shadow-2xl w-full max-w-sm animate-fadeUp">
                                        <h3 className="text-lg font-bold font-[var(--font-syne)] mb-4 text-[var(--text-primary)] flex items-center gap-2"><LogIn size={18} className="text-[var(--text-secondary)]" /> Join a Team</h3>
                                        <form onSubmit={handleJoinRoom}>
                                            <input type="text" placeholder="Enter 6-digit code" value={joinRoomId} onChange={e => setJoinRoomId(e.target.value)} className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-[var(--font-jetbrains)] placeholder-[var(--text-muted)] p-3 rounded-md mb-5 focus:outline-none focus:border-[var(--text-secondary)] transition-colors tracking-widest" maxLength={6} required />
                                            <div className="flex gap-3">
                                                <button type="button" onClick={() => setShowJoinRoom(false)} className="flex-1 py-2.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors text-sm font-semibold">Cancel</button>
                                                <button type="submit" className="flex-1 py-2.5 bg-transparent border border-[var(--border-bright)] text-[var(--text-secondary)] hover:text-[var(--accent-mint)] hover:border-[var(--accent-mint)] rounded-md transition-colors font-[var(--font-syne)] font-bold">Join</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-transparent relative z-10">
                        {/* Room Header */}
                        <div className="px-8 py-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-primary)]/80 backdrop-blur-md sticky top-0 z-20">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl font-bold font-[var(--font-syne)] text-[var(--text-primary)]">{selectedRoom.teamName}</h1>
                                    {project && (
                                        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${project.status === 'active' || project.status === 'done' ? 'bg-[var(--accent-mint)] shadow-[var(--accent-mint)]' : 'bg-[var(--accent-amber)] shadow-[var(--accent-amber)]'}`}></div>
                                    )}
                                </div>
                                <p className="mt-1.5 flex items-center gap-2">
                                    <span className="font-[var(--font-jetbrains)] text-[11px] bg-[var(--bg-elevated)] px-2 py-0.5 rounded text-[var(--text-muted)] border border-[var(--border)] tracking-widest">{selectedRoom.roomId}</span>
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                {/* Launch project button */}
                                {!project && (
                                    <button
                                        onClick={() => navigate('/research-setup', { state: { roomId: selectedRoom.roomId, teamName: selectedRoom.teamName, memberCount: selectedRoom.participants?.length } })}
                                        className="text-sm font-bold font-[var(--font-syne)] bg-[var(--accent-mint)] text-[#0A0E17] px-6 py-2 rounded-md hover:bg-[#2ee8ab] transition-all hover:shadow-[0_0_15px_rgba(79,255,196,0.3)] flex items-center gap-2"
                                    >
                                        <Sparkles size={16} /> Start Research Project
                                    </button>
                                )}
                                {project && !mySubtopic && user?.role !== 'teacher' && (
                                    <button
                                        onClick={handleAssignSubtopic}
                                        disabled={assigningSubtopic}
                                        className="text-[13px] font-bold font-[var(--font-syne)] bg-transparent border border-[var(--accent-amber)] text-[var(--accent-amber)] hover:bg-[rgba(255,179,71,0.1)] px-5 py-2 rounded-full transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {assigningSubtopic ? (
                                            <>
                                                <div className="w-3.5 h-3.5 border-2 border-[var(--accent-amber)] border-t-transparent rounded-full animate-spin" />
                                                Architecting Role...
                                            </>
                                        ) : <><Target size={16} /> Get Assigned Subtopic</>}
                                    </button>
                                )}
                                {mySubtopic && (
                                    <div className="flex gap-2">
                                        {project && (
                                            <button
                                                onClick={handleViewClusters}
                                                disabled={loadingClusters}
                                                className="text-[13px] font-semibold bg-transparent text-[var(--accent-amber)] px-5 py-2 rounded-full hover:bg-[rgba(255,179,71,0.1)] transition-colors border border-[var(--accent-amber)] flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {loadingClusters ? (
                                                    <><div className="w-3.5 h-3.5 border-2 border-[var(--accent-amber)] border-t-transparent rounded-full animate-spin" /> Clustering...</>
                                                ) : <><Target size={14} /> View Clusters</>}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                localStorage.setItem('projectId', project._id);
                                                localStorage.setItem('subtopicTitle', mySubtopic.title);
                                                localStorage.setItem('subtopicDescription', mySubtopic.description || '');
                                                localStorage.removeItem('isSupervisor');
                                                navigate('/agent-chat');
                                            }}
                                            className="text-[13px] font-semibold bg-transparent text-[var(--accent-mint)] px-5 py-2 rounded-full hover:bg-[rgba(79,255,196,0.1)] transition-colors border border-[var(--accent-mint)] flex items-center gap-2"
                                        >
                                            <MessageSquare size={14} /> Talk to My Agent
                                        </button>
                                        <button
                                            onClick={() => {
                                                localStorage.setItem('projectId', project._id);
                                                localStorage.setItem('subtopicTitle', 'Project Supervisor');
                                                localStorage.setItem('subtopicDescription', 'Overseeing the entire research project across all subtopics.');
                                                localStorage.setItem('isSupervisor', 'true');
                                                localStorage.setItem('teamName', selectedRoom?.teamName || 'Research Team');
                                                navigate('/agent-chat');
                                            }}
                                            className="text-[13px] font-semibold bg-transparent text-[var(--accent-violet)] px-5 py-2 rounded-full hover:bg-[rgba(123,97,255,0.1)] transition-colors border border-[var(--accent-violet)] flex items-center gap-2"
                                        >
                                            <Activity size={14} /> Talk to Supervisor
                                        </button>
                                    </div>
                                )}
                                {user?.role === 'teacher' && (
                                    <span className="text-[11px] font-[var(--font-jetbrains)] font-medium bg-[rgba(123,97,255,0.15)] text-[var(--accent-violet)] border border-[rgba(123,97,255,0.3)] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                                        <BookOpen size={12} /> Teacher Mode
                                    </span>
                                )}
                                <button onClick={() => { setSelectedRoom(null); setProject(null); }} className="text-[var(--text-muted)] hover:text-[var(--accent-coral)] transition-colors ml-2 p-2 rounded hover:bg-[rgba(255,107,107,0.1)]">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
                            {/* Research Project Panel */}
                            {loadingProject ? (
                                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 flex items-center gap-4 animate-pulse">
                                    <div className="w-5 h-5 border-2 border-[var(--accent-mint)] border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[var(--text-secondary)] font-medium">Loading project interface...</span>
                                </div>
                            ) : project ? (
                                <div className="animate-fadeUp">
                                    <div className="flex items-start justify-between mb-8">
                                        <div>
                                            <h2 className="text-3xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-2 tracking-tight">{project.topic}</h2>
                                        </div>
                                    </div>

                                    {/* Subtopic Assignments with Progress Tracker */}
                                    {project.subtopics?.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-5 border-b border-[var(--border)] pb-3">
                                                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.15em]">Agent Assignments & Progress</p>
                                                <div className="flex items-center gap-3">
                                                   
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
                                                {project.subtopics.map((s, i) => {
                                                    const isMe = s.assignedUserId === user?._id;
                                                    const progress = s.progress || 0;
                                                    const isExpanded = expandedSubtopic === i;

                                                    const progressHex = progress === 0 ? '#4A5568' : (isMe ? '#4FFFC4' : '#7B61FF');

                                                    return (
                                                        <div
                                                            key={i}
                                                            onClick={() => setExpandedSubtopic(isExpanded ? null : i)}
                                                            className={`rounded-lg cursor-pointer transition-all duration-300 bg-[var(--bg-surface)] hover:border-[var(--border-bright)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${isExpanded ? 'border-[var(--border-bright)]' : 'border border-[var(--border)]'}`}
                                                            style={{ animationDelay: `${i * 0.05}s` }}
                                                        >
                                                            {/* Card Header */}
                                                            <div className="p-6 relative overflow-hidden group">
                                                                <div className="flex items-center justify-between mb-4 relative z-10">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={`text-[10px] uppercase font-bold tracking-widest ${isMe ? 'text-[var(--accent-mint)]' : 'text-[var(--text-muted)]'}`}>Subtopic {i + 1}</span>
                                                                        {isMe && <span className="font-[var(--font-jetbrains)] text-[10px] bg-[rgba(79,255,196,0.15)] text-[var(--accent-mint)] border border-[rgba(79,255,196,0.3)] px-2 py-0.5 rounded text-xs">YOU</span>}
                                                                    </div>
                                                                    {/* Removed Circular Progress Indicator */}
                                                                </div>

                                                                <h3 className="font-[var(--font-syne)] font-bold text-[16px] text-[var(--text-primary)] mb-2 relative z-10">{s.title}</h3>
                                                                <p className="text-[13px] text-[var(--text-secondary)] leading-[1.6] line-clamp-2 relative z-10">{s.description}</p>

                                                                <div className="flex items-center justify-between mt-6 relative z-10">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <p className={`text-[12px] font-semibold ${isMe ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                                                                            <span className={isMe ? 'text-[var(--accent-mint)] mr-1' : 'text-[var(--accent-violet)] mr-1'}>→</span>
                                                                            {s.assignedUserName}
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-[11px] text-[var(--accent-mint)] font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                                                        Details <ArrowRight size={12} />
                                                                    </span>
                                                                </div>

                                                                {/* Hover glow effect background */}
                                                                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none ${isMe ? 'bg-gradient-to-tr from-[var(--accent-mint)] to-transparent' : 'bg-gradient-to-tr from-[var(--accent-violet)] to-transparent'}`}></div>
                                                            </div>

                                                            {/* Expanded Detail Panel */}
                                                            {/* Expanded Detail Panel */}
                                                            {isExpanded && (
                                                                <div className="px-4 pb-4 pt-4 border-t border-[rgba(255,255,255,0.05)] bg-[#0A0E17]/80 backdrop-blur-md rounded-b-xl space-y-4">
                                                                    {/* Removed Progress Breakdown */}                                                                    {/* Progress Tracker: Recommended Papers (Per Subtopic) */}
                                                                    {s.savedPapers && s.savedPapers.length > 0 && (
                                                                        <div className="pt-4 mt-2 border-t border-[rgba(255,255,255,0.05)]">
                                                                            <p className="text-[11px] font-bold text-[var(--accent-mint)] uppercase tracking-wider mb-3 font-[var(--font-jetbrains)]">Recommended Research Papers</p>
                                                                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                                                                {s.savedPapers.map(paper => (
                                                                                    <div key={paper._id} className={`flex items-start gap-3 p-3 rounded-lg border transition-all duration-300 ${paper.isRead ? 'bg-[rgba(79,255,196,0.05)] border-[var(--accent-mint)]/20' : 'bg-[#05070A]/50 border-[rgba(255,255,255,0.05)] hover:border-[var(--accent-mint)]/40 hover:bg-[#05070A]/80'}`}>
                                                                                        <div className="mt-0.5 relative flex items-center justify-center">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={!!paper.isRead}
                                                                                                onChange={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    togglePaperRead(paper._id);
                                                                                                }}
                                                                                                onClick={(e) => e.stopPropagation()}
                                                                                                className="w-4 h-4 text-[var(--accent-mint)] bg-transparent border-[rgba(255,255,255,0.2)] rounded focus:ring-[var(--accent-mint)] cursor-pointer"
                                                                                                title={paper.isRead ? "Mark as unread" : "Mark as read"}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <a href={paper.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`text-sm font-semibold hover:underline font-[var(--font-syne)] ${paper.isRead ? 'text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/50' : 'text-[var(--text-primary)] hover:text-[var(--accent-mint)] transition-colors'}`}>
                                                                                                {paper.title}
                                                                                            </a>
                                                                                            <p className={`text-[10px] mt-1 line-clamp-1 font-[var(--font-jetbrains)] ${paper.isRead ? 'text-[var(--text-muted)]/70' : 'text-[var(--text-secondary)]'}`}>
                                                                                                {paper.authors ? `By ${paper.authors}` : 'Authors unknown'}
                                                                                            </p>

                                                                                            {/* Paper Teacher Feedback */}
                                                                                            {(user?.role === 'teacher' || paper.teacherFeedback) && (
                                                                                                <div
                                                                                                    className="mt-3 bg-[rgba(123,97,255,0.05)] p-3 rounded-md border border-[var(--accent-violet)]/20"
                                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                                >
                                                                                                    <p className="text-[10px] font-bold text-[var(--accent-violet)] tracking-wider mb-2 font-[var(--font-jetbrains)]">Teacher Feedback:</p>
                                                                                                    {user?.role === 'teacher' ? (
                                                                                                        <div className="flex gap-2">
                                                                                                            <input
                                                                                                                type="text"
                                                                                                                id={`paper-feedback-${paper._id}`}
                                                                                                                className="flex-1 p-2 text-xs bg-[#05070A]/50 border border-[rgba(255,255,255,0.1)] rounded focus:ring-1 focus:border-[var(--accent-violet)] focus:ring-[var(--accent-violet)] outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)]"
                                                                                                                placeholder="Add note for this paper..."
                                                                                                                defaultValue={paper.teacherFeedback}
                                                                                                                onClick={(e) => e.stopPropagation()}
                                                                                                                onBlur={(e) => {
                                                                                                                    if (e.target.value !== paper.teacherFeedback) {
                                                                                                                        submitPaperFeedback(paper._id, e.target.value);
                                                                                                                    }
                                                                                                                }}
                                                                                                                onKeyDown={(e) => {
                                                                                                                    if (e.key === 'Enter') {
                                                                                                                        e.preventDefault();
                                                                                                                        submitPaperFeedback(paper._id, e.target.value);
                                                                                                                    }
                                                                                                                }}
                                                                                                            />
                                                                                                            <button
                                                                                                                type="button"
                                                                                                                onClick={(e) => {
                                                                                                                    e.stopPropagation();
                                                                                                                    const val = document.getElementById(`paper-feedback-${paper._id}`).value;
                                                                                                                    submitPaperFeedback(paper._id, val);
                                                                                                                }}
                                                                                                                className="px-3 py-1 bg-[var(--accent-violet)]/20 text-[var(--accent-violet)] hover:bg-[var(--accent-violet)] hover:text-[#0A0E17] text-xs font-bold rounded transition-colors uppercase tracking-wider"
                                                                                                            >
                                                                                                                Submit
                                                                                                            </button>
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <p className="text-xs text-[var(--text-secondary)] italic font-[var(--font-dm)]">{paper.teacherFeedback}</p>
                                                                                                    )}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <div className="pt-3 mt-1 border-t border-[rgba(255,255,255,0.05)]">
                                                                        <p className="text-[10px] text-[var(--text-muted)] italic font-[var(--font-dm)] text-center">
                                                                            Progress updates sync automatically. The researcher can log tasks and findings here.
                                                                        </p>
                                                                    </div>

                                                                    {/* Subtopic Teacher Feedback */}
                                                                    {(user?.role === 'teacher' || s.teacherFeedback) && (
                                                                        <div
                                                                            className="pt-4 border-t border-[rgba(123,97,255,0.2)] mt-3"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <p className="text-[11px] font-bold text-[var(--accent-violet)] uppercase tracking-wider mb-3 font-[var(--font-jetbrains)] flex items-center gap-1.5"><Bot size={14} /> Teacher Feedback (Subtopic)</p>
                                                                            {user?.role === 'teacher' ? (
                                                                                <div className="flex flex-col gap-3">
                                                                                    <textarea
                                                                                        id={`subtopic-feedback-${s._id}`}
                                                                                        className="w-full p-3 text-sm bg-[#05070A]/50 border border-[rgba(255,255,255,0.1)] rounded-lg focus:border-[var(--accent-violet)] focus:ring-1 focus:ring-[var(--accent-violet)] outline-none text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none"
                                                                                        rows="2"
                                                                                        placeholder="Leave feedback on their overall subtopic progress..."
                                                                                        defaultValue={s.teacherFeedback}
                                                                                        onBlur={(e) => {
                                                                                            if (e.target.value !== s.teacherFeedback) {
                                                                                                submitSubtopicFeedback(s._id, e.target.value);
                                                                                            }
                                                                                        }}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                                                e.preventDefault();
                                                                                                submitSubtopicFeedback(s._id, e.target.value);
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                    <div className="flex justify-between items-center">
                                                                                        <span className="text-[10px] text-[var(--text-muted)] font-[var(--font-jetbrains)]">Press Enter to submit, Shift+Enter for new line</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                const val = document.getElementById(`subtopic-feedback-${s._id}`).value;
                                                                                                submitSubtopicFeedback(s._id, val);
                                                                                            }}
                                                                                            className="px-4 py-2 bg-[var(--accent-violet)] text-[#0A0E17] text-xs font-bold rounded-lg hover:bg-[#8f7aff] hover:-translate-y-0.5 shadow-[0_5px_15px_rgba(123,97,255,0.2)] transition-all duration-300 uppercase tracking-widest font-[var(--font-syne)]"
                                                                                        >
                                                                                            Submit Feedback
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="bg-[rgba(123,97,255,0.05)] p-4 rounded-xl border border-[rgba(123,97,255,0.15)] text-sm text-[var(--text-secondary)] font-[var(--font-dm)] shadow-inner">
                                                                                    {s.teacherFeedback}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-[var(--bg-surface)] border border-dashed border-[var(--border-bright)] rounded-xl p-10 text-center animate-fadeUp flex flex-col items-center justify-center min-h-[250px]">
                                    <div className="w-16 h-16 rounded-full bg-[rgba(79,255,196,0.05)] flex items-center justify-center mb-4">
                                        <Sparkles className="text-[var(--accent-mint)]" size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-2">No research project yet.</h3>
                                    <p className="text-[var(--text-secondary)] mb-8 max-w-sm">When you're ready, start a new project to generate AI agents for your team.</p>
                                    <button
                                        onClick={() => navigate('/research-setup', { state: { roomId: selectedRoom.roomId, teamName: selectedRoom.teamName, memberCount: selectedRoom.participants?.length } })}
                                        className="px-8 py-3 bg-[var(--accent-mint)] text-[#0A0E17] rounded-md hover:bg-[#2ee8ab] transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(79,255,196,0.3)] font-bold font-[var(--font-syne)] text-sm flex items-center gap-2"
                                    >
                                        <Sparkles size={16} /> Start Research Project
                                    </button>
                                </div>
                            )}

                            {/* Team Members */}
                            <div className="animate-fadeUp" style={{ animationDelay: '0.2s' }}>
                                <h2 className="text-2xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-6 flex items-center gap-3">
                                    Team Members
                                    <span className="font-[var(--font-jetbrains)] text-[11px] bg-[rgba(79,255,196,0.1)] text-[var(--accent-mint)] px-2 py-0.5 rounded-full border border-[rgba(79,255,196,0.2)]">
                                        {selectedRoom.participants?.length || 0}
                                    </span>
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {selectedRoom.participants?.map((participant, idx) => {
                                        const assignedSub = project?.subtopics?.find(s => s.assignedUserId === participant._id);
                                        const isMe = participant._id === user._id;

                                        return (
                                            <div key={participant._id} className="flex items-center p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg hover:border-[var(--border-bright)] transition-colors group">
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--accent-violet)] to-[var(--accent-mint)] flex items-center justify-center text-white font-bold font-[var(--font-syne)] text-sm mr-4 flex-shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.3)] group-hover:scale-105 transition-transform">
                                                    {participant.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold font-[var(--font-syne)] text-[15px] text-[var(--text-primary)] truncate">{participant.name}</p>
                                                    <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">{participant.email}</p>
                                                    {assignedSub && (
                                                        <p className="text-[11px] text-[var(--accent-mint)] font-medium mt-1 truncate flex items-center gap-1.5 opacity-90">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${isMe ? 'bg-[var(--accent-mint)] shadow-[0_0_4px_var(--accent-mint)]' : 'bg-[var(--accent-violet)]'}`}></div>
                                                            {assignedSub.title}
                                                        </p>
                                                    )}
                                                </div>
                                                {isMe && (
                                                    <span className="ml-3 font-[var(--font-jetbrains)] text-[10px] bg-[rgba(79,255,196,0.15)] text-[var(--accent-mint)] border border-[rgba(79,255,196,0.3)] px-2 py-0.5 rounded flex-shrink-0">YOU</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Leaderboard Section */}
                            {project && project.subtopics && project.subtopics.length > 0 && (
                                <div className="mt-12 animate-fadeUp" style={{ animationDelay: '0.3s' }}>
                                    <h2 className="text-2xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-6 flex items-center gap-3">
                                        <Trophy className="text-[var(--accent-amber)]" size={24} />
                                        Top Researchers
                                    </h2>
                                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="px-6 py-4 font-semibold text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] border-b border-[var(--border)]">Researcher</th>
                                                    <th className="px-6 py-4 font-semibold text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] border-b border-[var(--border)]">Subtopic</th>
                                                    <th className="px-6 py-4 font-semibold text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)] border-b border-[var(--border)] text-right">Points</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...project.subtopics]
                                                    .sort((a, b) => (b.points || 0) - (a.points || 0))
                                                    .map((s, index) => {
                                                        const rankColor = index === 0 ? 'text-[var(--accent-mint)]' : index === 1 ? 'text-[var(--accent-violet)]' : index === 2 ? 'text-[var(--accent-coral)]' : 'text-[var(--text-muted)]';
                                                        return (
                                                            <tr key={s._id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                                                                <td className="px-6 py-4 font-bold font-[var(--font-syne)] text-[var(--text-primary)] flex items-center gap-4">
                                                                    <span className={`w-6 text-sm font-[var(--font-jetbrains)] ${rankColor}`}>#{index + 1}</span>
                                                                    {s.assignedUserName || 'Unassigned'}
                                                                </td>
                                                                <td className="px-6 py-4 text-[13px] text-[var(--text-secondary)]">{s.title}</td>
                                                                <td className="px-6 py-4 font-bold font-[var(--font-jetbrains)] text-[var(--accent-mint)] text-right text-lg">{s.points || 0}</td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>

            {/* Insights Modal */}
            {showInsightsModal && selectedPaper && (
                <div className="fixed inset-0 bg-[#0A0E17]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeUp">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border-bright)] rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.8)] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)] bg-[#080C14]">
                            <h2 className="text-2xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] mb-1 flex items-center gap-2"><Sparkles className="text-[var(--accent-mint)]" size={20} /> Reading Insights</h2>
                            <p className="text-[12px] font-[var(--font-jetbrains)] text-[var(--text-muted)] truncate flex items-center gap-2">
                                <span className="text-[var(--accent-violet)]">Paper ID:</span> {selectedPaper._id.substring(0, 8)}... <span className="mx-2">|</span> {selectedPaper.title}
                            </p>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                            {evalFeedback && (
                                <div className={`p-4 rounded-md text-[13px] font-[var(--font-jetbrains)] ${evalFeedback.startsWith('Error') ? 'bg-[rgba(255,107,107,0.1)] text-[var(--accent-coral)] border border-[rgba(255,107,107,0.3)]' : 'bg-[rgba(79,255,196,0.1)] text-[var(--accent-mint)] border border-[rgba(79,255,196,0.3)]'}`}>
                                    {evalFeedback}
                                </div>
                            )}

                            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed border-l-2 border-[var(--accent-violet)] pl-4 italic">
                                Excellent! You finished reading this paper. Please enter your insights to earn points. Your dedicated AI evaluator will grade your thoughts against your specific subtopic.
                            </p>

                            <div className="space-y-6">
                                {insightsData.map((item, index) => (
                                    <div key={index} className="flex flex-col group">
                                        <label className="text-[11px] font-[var(--font-jetbrains)] uppercase tracking-[0.1em] text-[var(--text-muted)] mb-3 flex items-center gap-2 group-focus-within:text-[var(--accent-mint)] transition-colors">
                                            <div className="w-1 h-1 rounded-full bg-[var(--accent-violet)] group-focus-within:bg-[var(--accent-mint)] transition-colors"></div>
                                            {item.heading}
                                        </label>
                                        <textarea
                                            className="w-full bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg p-4 text-[14px] leading-relaxed focus:border-[var(--accent-mint)] focus:ring-1 focus:ring-[var(--accent-mint)] outline-none resize-y min-h-[120px] transition-colors placeholder-[var(--text-muted)]"
                                            placeholder="What did you extract from this section?"
                                            value={item.content}
                                            onChange={(e) => {
                                                const newData = [...insightsData];
                                                newData[index].content = e.target.value;
                                                setInsightsData(newData);
                                            }}
                                            disabled={evaluatingInsights}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="px-8 py-5 border-t border-[var(--border)] bg-[#080C14] flex justify-end gap-4">
                            <button
                                onClick={() => { setShowInsightsModal(false); setSelectedPaper(null); }}
                                className="px-6 py-2.5 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] font-semibold text-sm transition-colors"
                                disabled={evaluatingInsights}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitInsights}
                                disabled={evaluatingInsights || insightsData.some(i => i.content.trim() === '')}
                                className="px-6 py-2.5 bg-[var(--accent-mint)] text-[#0A0E17] rounded-md hover:bg-[#2ee8ab] font-bold font-[var(--font-syne)] disabled:opacity-50 flex items-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(79,255,196,0.3)]"
                            >
                                {evaluatingInsights ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" />
                                        Evaluating...
                                    </>
                                ) : <><Send size={16} /> Submit & Earn Points</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clusters Modal */}
            {showClustersModal && clusterData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeUp">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--border)]">
                            <h2 className="text-xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] flex items-center gap-2">
                                <Target size={20} className="text-[var(--accent-amber)]" /> Paper Clusters
                            </h2>
                            <button onClick={() => setShowClustersModal(false)} className="text-[var(--text-muted)] hover:text-[var(--accent-coral)] transition-colors p-1 rounded hover:bg-[rgba(255,107,107,0.1)]">
                                ✕
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 space-y-6">
                            {!clusterData.ready ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[rgba(255,179,71,0.1)] border border-[var(--accent-amber)] flex items-center justify-center">
                                        <Target size={28} className="text-[var(--accent-amber)]" />
                                    </div>
                                    <p className="text-[var(--text-secondary)] text-lg font-medium mb-2">{clusterData.message}</p>
                                    <p className="text-[var(--text-muted)] text-sm font-[var(--font-jetbrains)]">Papers completed: {clusterData.count}/2</p>
                                </div>
                            ) : (
                                clusterData.clusters.map((cluster, idx) => (
                                    <div key={cluster.cluster_id} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-5">
                                        <h3 className="text-sm font-bold font-[var(--font-syne)] text-[var(--accent-mint)] mb-3 flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${idx === 0 ? 'bg-[var(--accent-mint)]' : idx === 1 ? 'bg-[var(--accent-violet)]' : 'bg-[var(--accent-amber)]'}`} />
                                            Cluster {cluster.cluster_id + 1}
                                            <span className="text-[var(--text-muted)] font-[var(--font-jetbrains)] text-[11px] font-normal">({cluster.papers.length} papers)</span>
                                        </h3>
                                        <div className="space-y-2">
                                            {cluster.papers.map((paper, pIdx) => (
                                                <div key={pIdx} className="flex items-start gap-3 text-sm bg-[var(--bg-surface)] rounded-lg p-3 border border-[var(--border)]">
                                                    <span className="text-[var(--text-muted)] font-[var(--font-jetbrains)] text-[11px] mt-0.5">{pIdx + 1}.</span>
                                                    <div className="flex-1">
                                                        <p className="text-[var(--text-primary)] font-medium">{paper.title}</p>
                                                        <p className="text-[var(--accent-mint)] text-[11px] font-[var(--font-jetbrains)] mt-1">by {paper.user_name || paper.user_id}</p>
                                                        {paper.feedback && (
                                                            <p className="text-[var(--text-secondary)] text-[12px] mt-2 italic leading-relaxed border-l-2 border-[var(--accent-violet)] pl-3">{paper.feedback}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="px-8 py-4 border-t border-[var(--border)] bg-[#080C14] flex justify-end">
                            <button
                                onClick={() => setShowClustersModal(false)}
                                className="px-6 py-2.5 bg-[var(--accent-mint)] text-[#0A0E17] rounded-md hover:bg-[#2ee8ab] font-bold font-[var(--font-syne)] text-sm transition-all hover:shadow-[0_0_15px_rgba(79,255,196,0.3)]"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Form Modal */}
            {showProfileModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeUp">
                    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-8 py-5 border-b border-[var(--border)]">
                            <h2 className="text-xl font-bold font-[var(--font-syne)] text-[var(--text-primary)] flex items-center gap-2">
                                <Sparkles size={20} className="text-[var(--accent-mint)]" /> Research Profile
                            </h2>
                            <button onClick={() => setShowProfileModal(false)} className="text-[var(--text-muted)] hover:text-[var(--accent-coral)] transition-colors p-1 rounded hover:bg-[rgba(255,107,107,0.1)]">
                                ✕
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 space-y-6">
                            <p className="text-[var(--text-secondary)] text-sm mb-2">Set up your research profile so we can assign you the best-fit subtopic.</p>

                            {/* Domain Expertise */}
                            <div>
                                <label className="block text-[12px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold mb-2">Domain Expertise *</label>
                                <input
                                    type="text"
                                    value={profileDomain}
                                    onChange={e => setProfileDomain(e.target.value)}
                                    placeholder="e.g. Machine Learning, Bioinformatics, NLP..."
                                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] font-[var(--font-dm-sans)] text-sm focus:outline-none focus:border-[var(--accent-mint)] transition-colors"
                                />
                            </div>

                            {/* Methodology Preferences */}
                            <div>
                                <label className="block text-[12px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold mb-3">Methodology Preferences</label>
                                <div className="flex flex-wrap gap-2">
                                    {methodologyOptions.map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => toggleMethodology(m)}
                                            className={`text-[12px] font-semibold px-4 py-2 rounded-full border transition-all ${profileMethodologies.includes(m)
                                                ? 'bg-[rgba(79,255,196,0.15)] border-[var(--accent-mint)] text-[var(--accent-mint)]'
                                                : 'bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                                                }`}
                                        >
                                            {profileMethodologies.includes(m) && '✓ '}{m}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Experience */}
                            <div>
                                <label className="block text-[12px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold mb-2">Experience</label>
                                <textarea
                                    value={profileExperience}
                                    onChange={e => setProfileExperience(e.target.value)}
                                    placeholder="Describe your research experience, past projects, skills..."
                                    rows={3}
                                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] font-[var(--font-dm-sans)] text-sm focus:outline-none focus:border-[var(--accent-mint)] transition-colors resize-none"
                                />
                            </div>

                            {/* Research Paper Link */}
                            <div>
                                <label className="block text-[12px] uppercase tracking-[0.15em] text-[var(--text-muted)] font-semibold mb-2">Research Paper Link (optional)</label>
                                <input
                                    type="text"
                                    value={profileResearchPaper}
                                    onChange={e => setProfileResearchPaper(e.target.value)}
                                    placeholder="https://arxiv.org/abs/..."
                                    className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] font-[var(--font-jetbrains)] text-sm focus:outline-none focus:border-[var(--accent-mint)] transition-colors"
                                />
                            </div>
                        </div>
                        <div className="px-8 py-5 border-t border-[var(--border)] bg-[#080C14] flex justify-end gap-4">
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="px-6 py-2.5 bg-transparent border border-[var(--border)] text-[var(--text-secondary)] rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] font-semibold text-sm transition-colors"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleProfileSave}
                                disabled={savingProfile || !profileDomain.trim()}
                                className="px-6 py-2.5 bg-[var(--accent-mint)] text-[#0A0E17] rounded-md hover:bg-[#2ee8ab] font-bold font-[var(--font-syne)] disabled:opacity-50 flex items-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(79,255,196,0.3)]"
                            >
                                {savingProfile ? (
                                    <><div className="w-4 h-4 border-2 border-[#0A0E17] border-t-transparent rounded-full animate-spin" /> Saving...</>
                                ) : <><Sparkles size={16} /> Save Profile</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Privacy Policy Footer */}
            <div className="absolute bottom-4 w-full text-center z-10 pointer-events-none">
                <p className="text-[10px] font-[var(--font-jetbrains)] text-[var(--text-muted)] tracking-wider">
                    <span className="opacity-50">PRIVACY POLICY:</span> WE DO NOT UTILIZE PERSONAL INFO FOR TRAINING MODELS.
                </p>
            </div>
        </div>
    );
};

export default Home;
