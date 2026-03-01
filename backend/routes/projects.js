const express = require('express');
const router = express.Router();
const axios = require('axios');

const Project = require('../models/Project');
const Room = require('../models/Room');
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

            const members = room.participants.map(p => ({
                id: p._id.toString(),
                name: p.name,
            }));

            if (members.length === 0) {
                return res.status(400).json({ message: 'Room has no participants.' });
            }

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
// GET /api/projects/:roomId
// Returns project + subtopics for the room
// ──────────────────────────────────────────────────────────────
router.get('/:roomId', protect, async (req, res) => {
    try {
        const project = await Project.findOne({ roomId: req.params.roomId });
        if (!project) return res.status(404).json({ message: 'No project found for this room.' });
        return res.json(project);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
