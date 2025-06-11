require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// Ensure the model path is correct. 'activity' vs 'Activity' depends on your file system.
// It's good practice to use 'Activity' (capital A) for model names.
const Activity = require('./models/activity'); 

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Body parser for JSON requests

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Exit process if connection fails
    });

// --- ROUTES ---

// NEW: Basic GET route for the root URL (to avoid "Cannot GET /" error)
// This serves as a simple confirmation that the server is running and accessible.
app.get('/', (req, res) => {
    res.send('Welcome to the Time Tracker Backend API!');
});


// @route   GET /api/activities/:date
// @desc    Get all activities for a specific date
// @access  Public
app.get('/api/activities/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const activity = await Activity.findOne({ date });

        if (!activity) {
            return res.status(200).json({ date, timeSlots: [] }); // Return empty for new dates
        }
        res.json(activity);
    } catch (err) {
        console.error('Error fetching activities:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/activities
// @desc    Create or update activities for a specific date
// @access  Public
app.post('/api/activities', async (req, res) => {
    try {
        const { date, timeSlots } = req.body;

        if (!date || !timeSlots || !Array.isArray(timeSlots)) {
            return res.status(400).json({ message: 'Invalid request body' });
        }

        // Find and update, or create if not found
        const updatedActivity = await Activity.findOneAndUpdate(
            { date },
            { $set: { timeSlots } }, // Overwrite existing timeSlots for the date
            { new: true, upsert: true, setDefaultsOnInsert: true } // Return the updated doc, create if not exists
        );

        res.status(200).json(updatedActivity);
    } catch (err) {
        console.error('Error saving activities:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/activities/history
// @desc    Get activity history for the last 7 days
// @access  Public
app.get('/api/activities/history', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of today

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6); // Go back 6 days to include today (7 days total)

        // Find activities within the last 7 days
        // We need to query dates as strings, so we can convert them to YYYY-MM-DD
        const recentDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(sevenDaysAgo.getDate() + i);
            recentDates.push(d.toISOString().split('T')[0]);
        }

        const history = await Activity.find({
            date: { $in: recentDates }
        }).sort({ date: 1 }); // Sort by date ascending

        // Format the output to ensure all 7 days are represented
        // even if no data exists, and calculate summaries for each day
        const formattedHistory = recentDates.map(d => {
            const foundDay = history.find(item => item.date === d);
            if (foundDay) {
                let productiveMinutes = 0;
                let wasteMinutes = 0;
                let neutralMinutes = 0;

                foundDay.timeSlots.forEach(slot => {
                    // Only count slots where an activity has been entered
                    if (slot.activity && slot.activity.trim() !== '') { 
                        if (slot.category === 'Productive') productiveMinutes += 30;
                        else if (slot.category === 'Waste') wasteMinutes += 30;
                        else if (slot.category === 'Neutral') neutralMinutes += 30;
                    }
                });

                return {
                    date: foundDay.date,
                    productive: productiveMinutes,
                    waste: wasteMinutes,
                    neutral: neutralMinutes,
                    // totalSlots here would reflect only *filled* slots, adjust if needed
                    totalSlots: (productiveMinutes + wasteMinutes + neutralMinutes) / 30, 
                };
            } else {
                return {
                    date: d,
                    productive: 0,
                    waste: 0,
                    neutral: 0,
                    totalSlots: 0
                };
            }
        });

        res.json(formattedHistory);

    } catch (err) {
        console.error('Error fetching history:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
