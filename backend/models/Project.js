const mongoose = require('mongoose');

const sourceDocSchema = new mongoose.Schema({
    type: { type: String, enum: ['pdf', 'url'], required: true },
    name: { type: String, required: true },   // filename or URL
    summary: { type: String, default: '' },
}, { _id: false });

const savedPaperSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    authors: { type: String },
    snippet: { type: String },
    summary: { type: String }, // Abstract / LLM summary for the Supervisor context
    citedBy: { type: Number, default: 0 },
    isRead: { type: Boolean, default: false },
    teacherFeedback: { type: String, default: '' },
    headings: [{ type: String }],
    savedAt: { type: Date, default: Date.now }
}, { _id: true });

const subtopicSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    assignedUserId: { type: String },         // MongoDB User _id as string
    assignedUserName: { type: String },
    agentSystemPrompt: { type: String },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    points: { type: Number, default: 0 },
    savedPapers: [savedPaperSchema],
    teacherFeedback: { type: String, default: '' },
}, { _id: true });

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
    savedPapers: [savedPaperSchema], // Preserved for backward compatibility
}, { timestamps: true });

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
