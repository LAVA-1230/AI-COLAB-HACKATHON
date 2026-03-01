const mongoose = require('mongoose');

const sourceDocSchema = new mongoose.Schema({
    type: { type: String, enum: ['pdf', 'url'], required: true },
    name: { type: String, required: true },   // filename or URL
    summary: { type: String, default: '' },
}, { _id: false });

const subtopicSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    assignedUserId: { type: String },         // MongoDB User _id as string
    assignedUserName: { type: String },
    agentSystemPrompt: { type: String },
}, { _id: false });

const projectSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        index: true,
    },
    topic: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['ingesting', 'planning', 'active', 'done', 'error'],
        default: 'planning',
    },
    sourceDocs: [sourceDocSchema],
    subtopics: [subtopicSchema],
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
