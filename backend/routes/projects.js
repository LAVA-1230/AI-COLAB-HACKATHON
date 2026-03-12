const express = require('express');
const router = express.Router();
const axios = require('axios');

const Project = require('../models/Project');
const Room = require('../models/Room');
const UserDetails = require('../models/UserDetails');
const PaperInsight = require('../models/PaperInsight');
const { protect } = require('../middleware/authMiddleware');

const AGENT_BACKEND = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';


// ──────────────────────────────────────────────────────────────
// POST /api/projects/create
// Body: JSON
//   roomId string (required)
//   topic  string (required)
// ──────────────────────────────────────────────────────────────
router.post(
    '/create',
    protect,
    async (req, res) => {
        let project = null;
        try {
            const { roomId, topic } = req.body;

            console.log(`[projects/create] Received request: roomId=${roomId}, topic=${topic}`);

            if (!roomId || !topic) {
                return res.status(400).json({ message: 'roomId and topic are required.' });
            }

            // ── Fetch room + participants ──────────────────────────
            const room = await Room.findOne({ roomId }).populate('participants', '_id name');
            if (!room) return res.status(404).json({ message: 'Room not found.' });

            if (!room.participants || room.participants.length === 0) {
                return res.status(400).json({ message: 'Room has no participants.' });
            }

            const participantIds = room.participants.map(p => p._id);
            const userDetailsDocs = await UserDetails.find({ user: { $in: participantIds } });

            const members = room.participants.map(p => {
                const detailsDoc = userDetailsDocs.find(d => d.user.toString() === p._id.toString());
                return {
                    id: p._id.toString(),
                    name: p.name,
                    domain: detailsDoc?.domain || "",
                    details: detailsDoc?.details || "",
                    previousResearch: detailsDoc?.previousResearch || ""
                };
            });

            console.log(members)

            // ── Create initial project document ───────────────────
            project = await Project.create({
                roomId,
                topic,
                status: 'planning',
                sourceDocs: [],
                subtopics: [],
            });

            // For the simplified flow we do not ingest external sources.
            // The planner will run immediately with an empty summaries list.

            // ── Step 2: Run LangGraph planner ─────────────────────
            const planResp = await axios.post(`${AGENT_BACKEND}/plan`, {
                topic,
                members,
            });

            const { subtopics, agent_prompts } = planResp.data;

            // Save subtopics to project
            project.subtopics = subtopics;
            project.status = 'done';
            await project.save();

            // ── Step 3: Register agents in FastAPI registry ───────
            await axios.post(`${AGENT_BACKEND}/register-agents`, {
                project_id: project._id.toString(),
                agent_prompts,
            });

            // ── Step 4: Link project to room ──────────────────────
            await Room.findOneAndUpdate({ roomId }, { projectId: project._id });

            return res.json({
                project,
                message: 'Research project created and agents assigned!',
            });

        } catch (err) {
            console.error('[projects/create]', err?.response?.data || err.message);
            if (project) {
                try { project.status = 'error'; await project.save(); } catch { };
            }
            res.status(500).json({ message: 'Failed to create project.', error: err.message });
        }
    }
);

// ──────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/assign-late-joiner
// Assigns a single subtopic to a user who joined after the project started
// ──────────────────────────────────────────────────────────────
router.post('/:projectId/assign-late-joiner', protect, async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const project = await Project.findById(projectId);

        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Find if user already has a subtopic
        const existingSubtopic = project.subtopics.find(s => s.assignedUserId === req.user._id.toString());
        if (existingSubtopic) {
            return res.status(400).json({ message: 'You already have an assigned subtopic in this project' });
        }
        console.log("yha tk to aa gye")
        // Fetch user profile
        const userDetailsDoc = await UserDetails.findOne({ user: req.user._id });
        const member = {
            id: req.user._id.toString(),
            name: req.user.name,
            domain: userDetailsDoc?.domain || "",
            details: userDetailsDoc?.details || "",
            previousResearch: userDetailsDoc?.previousResearch || ""
        };
        console.log("yha tk bhi aa gye")
        // Call Python Backend plan-single
        const planResp = await axios.post(`${AGENT_BACKEND}/plan-single`, {
            topic: project.topic,
            member: member,
            existing_subtopics: project.subtopics
        });

        const { subtopic, agent_prompt } = planResp.data;

        // Save to project
        project.subtopics.push(subtopic);
        await project.save();

        // Register agent
        await axios.post(`${AGENT_BACKEND}/register-agents`, {
            project_id: projectId,
            agent_prompts: {
                [req.user._id.toString()]: agent_prompt
            }
        });
        console.log("pura function hi run ho gya h")
        return res.json({ subtopic, message: 'Subtopic assigned successfully' });

    } catch (err) {
        console.error('[assign-late-joiner]', err?.response?.data || err.message);
        res.status(500).json({ message: 'Failed to assign subtopic.', error: err.message });
    }
});

// ──────────────────────────────────────────────────────────────
router.get('/:roomId', protect, async (req, res) => {
    try {
        const project = await Project.findOne({ roomId: req.params.roomId });
        if (!project) return res.status(404).json({ message: 'No project found for this room.' });

        // --- Backward Compatibility Migration ---
        // If there are legacy globally saved papers, move them into the current user's subtopic
        if (project.savedPapers && project.savedPapers.length > 0) {
            let targetSubtopic = project.subtopics.find(s => s.assignedUserId === req.user._id.toString());
            if (!targetSubtopic && project.subtopics.length > 0) {
                targetSubtopic = project.subtopics[0]; // fallback to first subtopic
            }
            if (targetSubtopic) {
                targetSubtopic.savedPapers.push(...project.savedPapers);
                project.savedPapers = [];
                await project.save();
            }
        }
        // ----------------------------------------

        return res.json(project);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ──────────────────────────────────────────────────────────────
// GET /api/projects/:projectId/context
// Returns a formatted text string of the workspace knowledge for the Supervisor Agent
// ──────────────────────────────────────────────────────────────
router.get('/:projectId/context', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        let totalPapers = 0;
        let readPapers = 0;
        let subtopicsStatusText = '';
        let papersBySubtopicText = '';

        project.subtopics.forEach((sub) => {
            const subPapers = sub.savedPapers || [];
            const subRead = subPapers.filter(p => p.isRead).length;
            const subTotal = subPapers.length;

            totalPapers += subTotal;
            readPapers += subRead;

            const progress = sub.progress || 0;
            const assignee = sub.assignedUserName || 'Unassigned';

            subtopicsStatusText += `- ${sub.title} → ${assignee} → ${subRead}/${subTotal} papers read → ${progress}% complete\n`;

            if (subTotal > 0) {
                papersBySubtopicText += `${sub.title}:\n`;
                subPapers.forEach(p => {
                    const mark = p.isRead ? '✓' : '○';
                    const status = p.isRead ? `${assignee}, read` : 'not yet read';
                    const summaryText = p.summary || p.snippet || 'No summary available.';
                    papersBySubtopicText += `  ${mark} ${p.title} (${status})\n    Summary: ${summaryText}\n`;
                });
                papersBySubtopicText += '\n';
            }
        });

        const unreadPapers = totalPapers - readPapers;

        const contextString = `WORKSPACE OVERVIEW:
- Main topic: ${project.topic}
- Total papers: ${totalPapers} (${readPapers} read, ${unreadPapers} unread)

SUBTOPICS AND STATUS:
${subtopicsStatusText || 'No subtopics yet.'}

PAPERS READ SO FAR (by subtopic):
${papersBySubtopicText || 'No papers saved yet.'}
`;

        return res.json({ context: contextString });
    } catch (err) {
        console.error('[projects/context]', err.message);
        res.status(500).json({ message: 'Error generating workspace context.' });
    }
});

// ──────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/papers
// Saves a reference to a research paper (called by Agent python backend)
// Body requires: { userId, title, link, authors, snippet, citedBy }
// ──────────────────────────────────────────────────────────────
router.post('/:projectId/papers', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        // Find the specific subtopic assigned to this user
        const subtopic = project.subtopics.find(s => s.assignedUserId === req.body.userId);
        if (!subtopic) return res.status(404).json({ message: 'Subtopic for this user not found.' });

        subtopic.savedPapers.push(req.body);
        await project.save();

        return res.json({ message: 'Paper saved.', paper: req.body });
    } catch (err) {
        console.error('[projects/papers]', err.message);
        res.status(500).json({ message: 'Failed to save paper.' });
    }
});

// ──────────────────────────────────────────────────────────────
// PUT /api/projects/:projectId/papers/:paperId/read
// Toggles the isRead status of a specific saved paper inside a subtopic
// ──────────────────────────────────────────────────────────────
router.put('/:projectId/papers/:paperId/read', async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        // Search through all subtopics to find the paper
        let targetPaper = null;
        for (const subtopic of project.subtopics) {
            targetPaper = subtopic.savedPapers.id(req.params.paperId);
            if (targetPaper) break;
        }

        if (!targetPaper) return res.status(404).json({ message: 'Paper not found in this project.' });

        targetPaper.isRead = !targetPaper.isRead;
        await project.save();

        return res.json({ message: 'Paper read status updated.', paper: targetPaper });
    } catch (err) {
        console.error('[projects/papers/read]', err.message);
        res.status(500).json({ message: 'Failed to update paper read status.' });
    }
});

// ──────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/papers/:paperId/insights
// Evaluates paper insights via LLM, saves it, and grants points
// ──────────────────────────────────────────────────────────────
router.post('/:projectId/papers/:paperId/insights', protect, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        // Search through all subtopics to find the subtopic and paper
        let targetSubtopic = null;
        let targetPaper = null;
        for (const subtopic of project.subtopics) {
            const p = subtopic.savedPapers.id(req.params.paperId);
            if (p) {
                targetSubtopic = subtopic;
                targetPaper = p;
                break;
            }
        }

        if (!targetPaper) return res.status(404).json({ message: 'Paper not found in this project.' });

        const insightsData = req.body.insights || []; // [{ heading, content }]
        const userId = req.user._id;

        // Call FastAPI to evaluate the insights
        let pointsAwarded = 0;
        let evaluationFeedback = "Evaluated successfully.";
        try {
            const evaluateRes = await axios.post('http://127.0.0.1:8000/evaluate_insights', {
                project_id: req.params.projectId,
                user_id: userId.toString(),
                paper_title: targetPaper.title,
                subtopic_description: targetSubtopic.description,
                insights: insightsData
            });
            pointsAwarded = evaluateRes.data.points || 0;
            evaluationFeedback = evaluateRes.data.feedback || evaluationFeedback;
        } catch (evalErr) {
            console.error('[projects/insights] Error calling Python evaluator:', evalErr.message);
            // Default to 1 point if the LLM fails, as a fallback, so the user isn't blocked entirely
            pointsAwarded = 1;
        }

        // Save the PaperInsight record
        const newInsight = new PaperInsight({
            projectId: project._id,
            paperId: targetPaper._id,
            userId: userId,
            insights: insightsData,
            pointsAwarded: pointsAwarded
        });
        await newInsight.save();

        // Update the project (mark as read + give points)
        targetPaper.isRead = true;
        targetSubtopic.points = (targetSubtopic.points || 0) + pointsAwarded;
        await project.save();

        return res.json({
            message: 'Insights submitted successfully.',
            points: pointsAwarded,
            feedback: evaluationFeedback
        });

    } catch (err) {
        console.error('[projects/papers/insights]', err.message);
        res.status(500).json({ message: 'Failed to submit insights.' });
    }
});

// ──────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/subtopics/:subtopicId/feedback
// Add Teacher Feedback to Subtopic
// ──────────────────────────────────────────────────────────────
router.post('/:projectId/subtopics/:subtopicId/feedback', protect, async (req, res) => {
    try {
        const { feedback } = req.body;
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        // Ensure user is authorized
        const room = await Room.findOne({ roomId: project.roomId });
        const isTeacher = room && room.teachers && room.teachers.some(t => t.toString() === req.user._id.toString());
        if (!isTeacher) return res.status(403).json({ message: 'Only teachers can add feedback.' });

        const subtopic = project.subtopics.id(req.params.subtopicId);
        if (!subtopic) return res.status(404).json({ message: 'Subtopic not found.' });

        subtopic.teacherFeedback = feedback;
        await project.save();

        return res.json({ message: 'Feedback added.', subtopic });
    } catch (err) {
        console.error('[projects/subtopics/feedback]', err.message);
        res.status(500).json({ message: 'Failed to add feedback.' });
    }
});

// ──────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/papers/:paperId/feedback
// Add Teacher Feedback to Individual Target Paper
// ──────────────────────────────────────────────────────────────
router.post('/:projectId/papers/:paperId/feedback', protect, async (req, res) => {
    try {
        const { feedback } = req.body;
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        // Ensure user is authorized
        const room = await Room.findOne({ roomId: project.roomId });
        const isTeacher = room && room.teachers && room.teachers.some(t => t.toString() === req.user._id.toString());
        if (!isTeacher) return res.status(403).json({ message: 'Only teachers can add feedback.' });

        // Papers are nested inside subtopics
        let foundPaper = null;
        for (const subtopic of project.subtopics) {
            foundPaper = subtopic.savedPapers.id(req.params.paperId);
            if (foundPaper) break;
        }

        if (!foundPaper) return res.status(404).json({ message: 'Paper not found.' });

        foundPaper.teacherFeedback = feedback;
        await project.save();

        return res.json({ message: 'Feedback added.', paper: foundPaper });
    } catch (err) {
        console.error('[projects/papers/feedback]', err.message);
        res.status(500).json({ message: 'Failed to add feedback.' });
    }
});

// ──────────────────────────────────────────────────────────────
// POST /api/projects/:projectId/clusters
// Proxy to Python backend for K-Means clustering of paper embeddings
// ──────────────────────────────────────────────────────────────
router.post('/:projectId/clusters', protect, async (req, res) => {
    try {
        const project = await Project.findById(req.params.projectId);
        if (!project) return res.status(404).json({ message: 'Project not found.' });

        const clusterRes = await axios.post(`${AGENT_BACKEND}/cluster-papers`, {
            project_id: req.params.projectId
        });

        const data = clusterRes.data;

        // If clustering is ready, resolve user_ids to names
        if (data.ready && data.clusters) {
            // Collect all unique user_ids
            const allUserIds = new Set();
            data.clusters.forEach(c => c.papers.forEach(p => {
                if (p.user_id) allUserIds.add(p.user_id);
            }));

            // Fetch user names from MongoDB
            const User = require('../models/User');
            const users = await User.find({ _id: { $in: [...allUserIds] } }, '_id name');
            const userMap = {};
            users.forEach(u => { userMap[u._id.toString()] = u.name; });

            // Replace user_id with user_name
            data.clusters.forEach(c => {
                c.papers.forEach(p => {
                    p.user_name = userMap[p.user_id] || p.user_id;
                });
            });
        }

        return res.json(data);
    } catch (err) {
        console.error('[projects/clusters]', err?.response?.data || err.message);
        res.status(500).json({ message: 'Failed to get clusters.', error: err.message });
    }
});

module.exports = router;
