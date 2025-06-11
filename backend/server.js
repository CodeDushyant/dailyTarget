require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Activity = require('./models/activity');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// ✅ Proper CORS config
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:62228',
    'https://dailytarget-112.onrender.com',
    'https://creative-semifreddo-756606.netlify.app',
    'https://daily-target-f3rf.vercel.app/' // ✅ Your frontend
];

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    }
}));

app.use(express.json());

// ✅ MongoDB connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// ✅ Default root route
app.get('/', (req, res) => {
    res.send('Welcome to the Time Tracker Backend API!');
});

// ✅ Get activities by date
app.get('/api/activities/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const activity = await Activity.findOne({ date });
        if (!activity) {
            return res.status(200).json({ date, timeSlots: [] });
        }
        res.json(activity);
    } catch (err) {
        console.error('Error fetching activities:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ Save or update activities
app.post('/api/activities', async (req, res) => {
    try {
        const { date, timeSlots } = req.body;
        if (!date || !timeSlots || !Array.isArray(timeSlots)) {
            return res.status(400).json({ message: 'Invalid request body' });
        }

        const updatedActivity = await Activity.findOneAndUpdate(
            { date },
            { $set: { timeSlots } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json(updatedActivity);
    } catch (err) {
        console.error('Error saving activities:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ Get activity history (last 7 days)
app.get('/api/activities/history', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);

        const recentDates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(sevenDaysAgo.getDate() + i);
            recentDates.push(d.toISOString().split('T')[0]);
        }

        const history = await Activity.find({
            date: { $in: recentDates }
        }).sort({ date: 1 });

        const formattedHistory = recentDates.map(d => {
            const foundDay = history.find(item => item.date === d);
            if (foundDay) {
                let productiveMinutes = 0;
                let wasteMinutes = 0;
                let neutralMinutes = 0;

                foundDay.timeSlots.forEach(slot => {
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

// ✅ Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
