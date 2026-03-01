const express = require('express');
const router = express.Router();
const UserDetails = require('../models/UserDetails');
const { protect } = require('../middleware/authMiddleware');

// Get User Details
router.get('/', protect, async (req, res) => {
    try {
        const userDetails = await UserDetails.findOne({ user: req.user._id });
        if (!userDetails) {
            return res.status(200).json({});
        }
        res.status(200).json(userDetails);
    } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Create or Update User Details
router.post('/', protect, async (req, res) => {
    try {
        const { details, domain, previousResearch, researchPaper } = req.body;

        let userDetails = await UserDetails.findOne({ user: req.user._id });

        if (userDetails) {
            // Update
            userDetails.details = details;
            userDetails.domain = domain;
            userDetails.previousResearch = previousResearch;
            userDetails.researchPaper = researchPaper;
            await userDetails.save();
        } else {
            // Create
            userDetails = new UserDetails({
                user: req.user._id,
                details,
                domain,
                previousResearch,
                researchPaper
            });
            await userDetails.save();
        }

        res.status(200).json(userDetails);
    } catch (error) {
        console.error("Error saving user details:", error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
