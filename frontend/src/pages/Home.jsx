import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

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

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post(`${ENDPOINT}/api/rooms/create`, { teamName: createTeamName });
            setRooms([...rooms, data]);
            setCreatedRoomCode(data.roomId);
            setShowCreateRoom(false);
            setCreateTeamName('');
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
        <div className="flex h-screen overflow-hidden bg-gray-100">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">My Teams</h2>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/profile')} className="text-sm font-semibold text-blue-600 hover:text-blue-800">Profile</button>
                        <button onClick={logout} className="text-sm text-red-500 hover:text-red-700">Logout</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {rooms.length === 0 ? (
                        <p className="p-4 text-gray-500 text-sm">No teams joined yet.</p>
                    ) : rooms.map((room) => (
                        <div
                            key={room._id}
                            onClick={() => {
                                fetchRoomDetails(room.roomId);
                                setCreatedRoomCode(null);
                                setShowJoinRoom(false);
                                setShowCreateRoom(false);
                            }}
                            className={`p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 ${selectedRoom?._id === room._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                        >
                            <p className="font-semibold text-gray-700 truncate">{room.teamName}</p>
                            <p className="text-xs text-gray-500">ID: {room.roomId}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-y-auto">
                {!selectedRoom ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome, {user?.name}!</h1>
                        <p className="text-gray-500 mb-12">Select a team from the sidebar or create/join one.</p>

                        {createdRoomCode ? (
                            <div className="bg-green-100 p-8 rounded-lg shadow-md text-center max-w-md w-full mb-8">
                                <h3 className="text-2xl font-bold text-green-800 mb-2">Team Created!</h3>
                                <p className="text-green-700 mb-4">Share this code with your teammates:</p>
                                <div className="text-4xl font-mono font-bold bg-white py-4 rounded border-2 border-green-200 select-all">{createdRoomCode}</div>
                                <button onClick={() => setCreatedRoomCode(null)} className="mt-6 text-green-700 underline hover:text-green-900">Done</button>
                            </div>
                        ) : (
                            <div className="flex space-x-6 items-start">
                                {!showCreateRoom ? (
                                    <button onClick={() => { setShowCreateRoom(true); setShowJoinRoom(false); }} className="px-8 py-4 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transform hover:-translate-y-1 transition text-lg font-semibold flex flex-col items-center min-w-[200px]">
                                        <span className="text-3xl mb-2">+</span>Create Team
                                    </button>
                                ) : (
                                    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
                                        <h3 className="text-xl font-bold mb-4">Create New Team</h3>
                                        <form onSubmit={handleCreateRoom}>
                                            <input type="text" placeholder="Enter Team Name" value={createTeamName} onChange={e => setCreateTeamName(e.target.value)} className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 outline-none" required />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setShowCreateRoom(false)} className="flex-1 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
                                                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                                {!showJoinRoom ? (
                                    <button onClick={() => { setShowJoinRoom(true); setShowCreateRoom(false); }} className="px-8 py-4 bg-purple-600 text-white rounded-xl shadow-lg hover:bg-purple-700 transform hover:-translate-y-1 transition text-lg font-semibold flex flex-col items-center min-w-[200px]">
                                        <span className="text-3xl mb-2">→</span>Join Team
                                    </button>
                                ) : (
                                    <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
                                        <h3 className="text-xl font-bold mb-4">Join a Team</h3>
                                        <form onSubmit={handleJoinRoom}>
                                            <input type="text" placeholder="Enter 6-digit code" value={joinRoomId} onChange={e => setJoinRoomId(e.target.value)} className="w-full border p-3 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 outline-none" maxLength={6} required />
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => setShowJoinRoom(false)} className="flex-1 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">Cancel</button>
                                                <button type="submit" className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Join</button>
                                            </div>
                                        </form>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-white">
                        {/* Room Header */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800">{selectedRoom.teamName}</h1>
                                <p className="text-gray-500 mt-1">Room ID: <span className="font-mono font-bold bg-gray-200 px-2 py-0.5 rounded">{selectedRoom.roomId}</span></p>
                            </div>
                            <div className="flex items-center space-x-3">
                                <span className="text-sm font-semibold bg-blue-100 text-blue-800 px-3 py-1 rounded-full">You: {user?.name}</span>
                                {/* Launch project button — visible to all, but ideally gated to creator */}
                                {!project && (
                                    <button
                                        onClick={() => navigate('/research-setup', { state: { roomId: selectedRoom.roomId, teamName: selectedRoom.teamName, memberCount: selectedRoom.participants?.length } })}
                                        className="text-sm font-semibold bg-indigo-600 text-white px-4 py-2 rounded-full hover:bg-indigo-700 transition shadow-md"
                                    >
                                        🚀 Start Research Project
                                    </button>
                                )}
                                {mySubtopic && (
                                    <button
                                        onClick={() => {
                                            localStorage.setItem('projectId', project._id);
                                            localStorage.setItem('subtopicTitle', mySubtopic.title);
                                            localStorage.setItem('subtopicDescription', mySubtopic.description || '');
                                            navigate('/agent-chat');
                                        }}
                                        className="text-sm font-semibold bg-green-100 text-green-800 px-3 py-1 rounded-full hover:bg-green-200 transition"
                                    >
                                        Talk to My Agent 🤖
                                    </button>
                                )}
                                <button onClick={() => { setSelectedRoom(null); setProject(null); }} className="text-gray-500 hover:text-gray-700">✕</button>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Research Project Panel */}
                            {loadingProject ? (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-indigo-700 font-medium">Loading project...</span>
                                </div>
                            ) : project ? (
                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-indigo-900">📚 Research Project</h2>
                                            <p className="text-indigo-700 font-medium mt-1">{project.topic}</p>
                                        </div>
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {project.status}
                                        </span>
                                    </div>

                                    {/* Source Docs */}
                                    {project.sourceDocs?.length > 0 && (
                                        <div className="mb-5">
                                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">Source Materials</p>
                                            <div className="flex flex-wrap gap-2">
                                                {project.sourceDocs.map((doc, i) => (
                                                    <span key={i} className="text-xs bg-white border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full flex items-center gap-1.5">
                                                        {doc.type === 'pdf' ? '📄' : '🔗'} {doc.name.length > 40 ? doc.name.slice(0, 40) + '…' : doc.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Subtopic Assignments */}
                                    {project.subtopics?.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-3">Agent Assignments</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {project.subtopics.map((s, i) => {
                                                    const isMe = s.assignedUserId === user?._id;
                                                    return (
                                                        <div key={i} className={`rounded-xl p-4 border ${isMe ? 'bg-green-50 border-green-200' : 'bg-white border-indigo-100'}`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-bold text-indigo-500 uppercase">Subtopic {i + 1}</span>
                                                                {isMe && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">YOU</span>}
                                                            </div>
                                                            <p className="font-semibold text-gray-800 text-sm">{s.title}</p>
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>
                                                            <p className="text-xs text-indigo-600 font-medium mt-2">👤 {s.assignedUserName}</p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-indigo-50 border border-dashed border-indigo-200 rounded-2xl p-6 text-center">
                                    <p className="text-indigo-500 font-medium mb-3">No research project yet.</p>
                                    <button
                                        onClick={() => navigate('/research-setup', { state: { roomId: selectedRoom.roomId, teamName: selectedRoom.teamName, memberCount: selectedRoom.participants?.length } })}
                                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-semibold text-sm"
                                    >
                                        🚀 Start Research Project
                                    </button>
                                </div>
                            )}

                            {/* Team Members */}
                            <div>
                                <h2 className="text-xl font-semibold mb-4 flex items-center">
                                    <span className="bg-green-100 text-green-800 p-2 rounded-lg mr-3">👥</span>
                                    Team Members ({selectedRoom.participants?.length || 0})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {selectedRoom.participants?.map((participant) => {
                                        const assignedSub = project?.subtopics?.find(s => s.assignedUserId === participant._id);
                                        return (
                                            <div key={participant._id} className="flex items-center p-4 border rounded-xl hover:shadow-md transition bg-gray-50">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg mr-4 flex-shrink-0">
                                                    {participant.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-800 truncate">{participant.name}</p>
                                                    <p className="text-sm text-gray-500 truncate">{participant.email}</p>
                                                    {assignedSub && (
                                                        <p className="text-xs text-indigo-600 font-medium mt-0.5 truncate">🤖 {assignedSub.title}</p>
                                                    )}
                                                </div>
                                                {participant._id === user._id && (
                                                    <span className="ml-2 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded flex-shrink-0">YOU</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;
