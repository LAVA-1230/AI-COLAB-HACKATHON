import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
            setMessage('Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <div className="bg-white shadow p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-gray-800">My Profile</h1>
                <button
                    onClick={() => navigate('/')}
                    className="text-gray-600 hover:text-gray-900"
                >
                    &larr; Back to Home
                </button>
            </div>

            <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
                <div className="bg-white rounded-xl shadow-md p-8">
                    {message && (
                        <div className={`p-4 rounded-lg mb-6 ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Name</label>
                                <input
                                    type="text"
                                    value={user?.name || ''}
                                    disabled
                                    className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-600 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
                                <input
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-600 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Professional Details
                                <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={details}
                                onChange={(e) => setDetails(e.target.value)}
                                placeholder="Tell us about yourself, your expertise, and interests..."
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">
                                    Domain/Field of Study
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    placeholder="e.g. AI, Neuroscience, Cyber Security"
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 text-sm font-bold mb-2">
                                    Link to Research Paper (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={researchPaper}
                                    onChange={(e) => setResearchPaper(e.target.value)}
                                    placeholder="e.g. https://arxiv.org/abs/..."
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Previous Research Experience (Optional)
                            </label>
                            <textarea
                                value={previousResearch}
                                onChange={(e) => setPreviousResearch(e.target.value)}
                                placeholder="Describe your past research projects or contributions..."
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none h-32"
                            />
                        </div>

                        <div className="flex justify-end gap-4">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className={`px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold ${saving ? 'opacity-70 cursor-wait' : ''}`}
                            >
                                {saving ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
