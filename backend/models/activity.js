const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    date: {
        type: String, // Storing date as YYYY-MM-DD string
        required: true,
        index: true // Index for faster date-based queries
    },
    timeSlots: [{
        startTime: {
            type: String, // e.g., "9:00 AM"
            required: true
        },
        endTime: {
            type: String, // e.g., "9:30 AM"
            required: true
        },
        activity: {
            type: String,
            default: ''
        },
        category: {
            type: String,
            enum: ['Productive', 'Waste', 'Neutral'],
            required: true
        }
    }]
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

module.exports = mongoose.model('Activity', activitySchema);