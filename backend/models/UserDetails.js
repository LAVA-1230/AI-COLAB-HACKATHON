const mongoose = require('mongoose');

const userDetailsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    details: {
        type: String,
        required: true
    },
    domain: {
        type: String,
        required: true
    },
    previousResearch: {
        type: String,
        default: ''
    },
    researchPaper: {
        type: String,
        default: ''
    }
}, { timestamps: true });

const UserDetails = mongoose.model('UserDetails', userDetailsSchema);
module.exports = UserDetails;
