const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const { protect } = require('../middleware/authMiddleware');

// Helper to generate 6-digit code
const generateRoomCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Create a new room
// @route   POST /api/rooms/create
// @access  Private
router.post('/create', protect, async (req, res) => {
    const { teamName } = req.body;

    if (!teamName) {
        return res.status(400).json({ message: 'Team name is required' });
    }

    try {
        let roomId = generateRoomCode();

        // Ensure uniqueness (extremely unlikely collision but good practice)
        let roomExists = await Room.findOne({ roomId });
        while (roomExists) {
            roomId = generateRoomCode();
            roomExists = await Room.findOne({ roomId });
        }

        const room = await Room.create({
            roomId,
            teamName,
            creator: req.user._id,
            participants: [req.user._id]
        });

        res.status(201).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @desc    Join a room
// @route   POST /api/rooms/join
// @access  Private
router.post('/join', protect, async (req, res) => {
    const { roomId } = req.body;

    try {
        const room = await Room.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Check if user is already a participant
        if (room.participants.includes(req.user._id)) {
            return res.status(200).json(room); // Already joined, just return room
        }

        room.participants.push(req.user._id);
        await room.save();

        res.status(200).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @desc    Get user's rooms
// @route   GET /api/rooms/my-rooms
// @access  Private
router.get('/my-rooms', protect, async (req, res) => {
    try {
        const rooms = await Room.find({ participants: req.user._id });
        res.status(200).json(rooms);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// @desc    Get specific room details
// @route   GET /api/rooms/:roomId
// @access  Private
router.get('/:roomId', protect, async (req, res) => {
    try {
        const room = await Room.findOne({ roomId: req.params.roomId })
            .populate('participants', 'name email');

        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Ensure user is authorized to view this room
        const isParticipant = room.participants.some(p => p._id.toString() === req.user._id.toString());
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not authorized to view this room' });
        }

        res.status(200).json(room);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
