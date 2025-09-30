
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

const cron = require('node-cron');


// Middleware
app.use(cors({
    origin: ['http://127.0.0.1:5500','http://127.0.0.1:5501', 'http://localhost:5500', 'http://localhost:5000', 'https://veriguard101.netlify.app'],
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Handle preflight requests
app.options('*', cors()); // Enable preflight for all routes

app.use(bodyParser.json());

app.use(express.json());



app.use(express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'models')));



// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("MongoDB Connection Error:", err));


// Define Schema & Model
const faceSchema = new mongoose.Schema({
    pic: String,  // Store Base64 as a regular String
    name: String,
    regno: {
        type: String,
        unique: true  // Ensure regno is unique
    },
    embeddings: [[Number]]  // Array of face embeddings
}, {
    collection: 'faces',
    timestamps: true  // Both options in one object
});

const Face = mongoose.model('Face', faceSchema);



// Add this near your other schema definitions
const systemSchema = new mongoose.Schema({
    _id: { type: String, default: 'attendance_tracker' },
    lastInitializedDate: String
}, { collection: 'system_settings' });

const SystemSettings = mongoose.model('SystemSettings', systemSchema);



app.use(async (req, res, next) => {
    try {
        const today = getCurrentDate();
        const settings = await SystemSettings.findOne({ _id: 'attendance_tracker' });

        if (!settings || settings.lastInitializedDate !== today) {
            await initializeDailyAttendance();
        }
    } catch (error) {
        console.error('Daily check failed:', error);
    }
    next();
});



// __________________________--------------________________________________ LOGIN ____________________________________-----------________________________________ //

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');


// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 1. Find admin
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    // 2. Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    // 3. Create JWT token
    const token = jwt.sign(
      { id: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 4. Send response
    res.json({ 
      success: true,
      token,
      username: admin.username 
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verification middleware
function authenticate(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid token' });
  }
}

// Protected route example
app.get('/api/protected', authenticate, (req, res) => {
  res.json({ 
    message: 'Protected content', 
    user: req.user 
  });
});


// __________________________--------------________________________________ DASHBOARD PAGE ____________________________________-----------________________________________ //


// Schema for Unknown/Spoofing Logs
const unknownSpoofLogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        enum: ['unknown', 'spoofing']
    },
    identity: {
        type: String,
        required: true
    },
    picture: {
        type: String,
        required: true
    },
    time: {
        type: Date,
        required: true,
        default: Date.now
    }
}, {
    collection: 'unknown_spoof_logs',
    timestamps: true
});

const UnknownSpoofLog = mongoose.model('UnknownSpoofLog', unknownSpoofLogSchema);

// Schema for Attendance Logs
const attendanceLogSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    attend: [{
        regno: String,
        name: String,
        status: {
            type: String,
            enum: ['present', 'absent'],
            default: 'absent'
        },
        lastRecognized: Date
    }]
}, {
    collection: 'attendance_logs',
    timestamps: true
});

const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);


// API to create unknown/spoofing logs
app.post('/api/logs', async (req, res) => {
    try {
        const { title, identity, picture, time } = req.body;

        // Basic validation
        if (!title || !['unknown', 'spoofing'].includes(title)) {
            return res.status(400).json({ error: 'Invalid or missing title' });
        }

        if (!identity) {
            return res.status(400).json({ error: 'Missing identity' });
        }

        if (!picture || !picture.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid or missing picture' });
        }

        // Create new log
        const newLog = new UnknownSpoofLog({
            title,
            identity,
            picture,
            time: time ? new Date(time) : new Date()
        });

        await newLog.save();

        res.status(201).json({
            success: true,
            data: newLog
        });
    } catch (error) {
        console.error('Error creating log:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});


app.get('/api/logsget', async (req, res) => {
    try {
        const { type, startDate, endDate, search, limit } = req.query;
        let query = {};

        if (type && ['unknown', 'spoofing'].includes(type)) {
            query.title = type;
        }

        if (search) {
            query.identity = { $regex: search, $options: 'i' };
        }

        if (startDate && endDate) {
            query.time = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const logsQuery = UnknownSpoofLog.find(query).sort({ time: -1 });

        if (limit) {
            logsQuery.limit(parseInt(limit));
        }

        const logs = await logsQuery.exec();

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});



// Attendance Routes
app.post('/api/attendance/initialize', async (req, res) => {
    try {

        const now = new Date();
        now.setHours(now.getHours() + 5); // Adjust for UTC+5 (Pakistan time)
        const today = now.toISOString().split('T')[0];


        const existingLog = await AttendanceLog.findOne({ date: today });

        if (existingLog) {
            return res.status(200).json({ message: 'Attendance log already exists for today' });
        }

        // Get all enrolled persons
        const enrolledPersons = await Face.find({}, 'regno name');

        // Create attendance log with all persons marked as absent
        const newAttendanceLog = new AttendanceLog({
            date: today,
            attend: enrolledPersons.map(person => ({
                regno: person.regno,
                name: person.name,
                status: 'absent'
            }))
        });

        await newAttendanceLog.save();
        res.status(201).json(newAttendanceLog);
    } catch (error) {
        console.error('Error initializing attendance:', error);
        res.status(500).json({ error: 'Failed to initialize attendance' });
    }
});

app.post('/api/attendance/mark', async (req, res) => {
    try {
        const { regno } = req.body;
        if (!regno) {
            return res.status(400).json({ error: 'Registration number is required' });
        }

        const now = new Date();
        now.setHours(now.getHours() + 5); // Adjust for UTC+5 (Pakistan time)
        const today = now.toISOString().split('T')[0];
        
        const person = await Face.findOne({ regno }, 'regno name');

        if (!person) {
            return res.status(404).json({ error: 'Person not found in enrolled list' });
        }

        // Update or create attendance log
        const attendanceLog = await AttendanceLog.findOneAndUpdate(
            { date: today },
            {
                $set: {
                    "attend.$[elem].status": "present",
                    "attend.$[elem].lastRecognized": new Date()
                }
            },
            {
                arrayFilters: [{ "elem.regno": regno }],
                new: true,
                upsert: true
            }
        );

        res.status(200).json(attendanceLog);
    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

app.get('/api/attendance/today', async (req, res) => {
    try {


        const now = new Date();
        now.setHours(now.getHours() + 5); // Adjust for UTC+5 (Pakistan time)
        const today = now.toISOString().split('T')[0];


        const attendanceLog = await AttendanceLog.findOne({ date: today });

        if (!attendanceLog) {
            return res.status(404).json({ message: 'No attendance record for today yet' });
        }

        res.status(200).json(attendanceLog);
    } catch (error) {
        console.error('Error fetching today\'s attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

app.get('/api/attendance/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const attendanceLog = await AttendanceLog.findOne({ date });

        if (!attendanceLog) {
            return res.status(404).json({ message: `No attendance record for ${date}` });
        }

        res.status(200).json(attendanceLog);
    } catch (error) {
        console.error('Error fetching attendance by date:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});




// load data
app.get('/api/embeddings', async (req, res) => {
    try {
        const faces = await Face.find({});
        res.json(faces);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});




// __________________________--------------________________________________ ENROLL PAGE ____________________________________-----------________________________________ //


// API Route to Enroll Face
app.post('/enroll', async (req, res) => {
    try {
        const { pic, name, regno, embeddings } = req.body;

        if (!name || !regno || !embeddings) {
            return res.status(400).json({ message: "Missing registration number or embedding" });
        }

        // Check if user already exists
        const existingUser = await Face.findOne({ regno });
        if (existingUser) {
            return res.status(400).json({ message: "User already enrolled" });
        }

        // Save to MongoDB
        const newFace = new Face({ pic, name, regno, embeddings });
        await newFace.save();

        // Get current date
        const today = getCurrentDate();
        
        // Check if there's an attendance log for today
        const attendanceLog = await AttendanceLog.findOne({ date: today });
        
        if (attendanceLog) {
            // Add new person to today's attendance log as absent
            attendanceLog.attend.push({
                regno: regno,
                name: name,
                status: 'absent'
            });
            
            await attendanceLog.save();
        }

        res.json({ message: "Face enrolled successfully!" });
    } catch (error) {
        console.error("Error in /enroll:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Server-side route to check regno
app.post('/api/check-regno', async (req, res) => {
    const { regno } = req.body;

    try {
        // Query your database to check if regno exists
        const user = await Face.findOne({ regno });
        res.json({ exists: !!user });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});





// __________________________--------------________________________________ RECORDS PAGE ____________________________________-----------________________________________ //


// Combined Records Routes
// Get all records or search
app.get('/api/records/search', async (req, res) => {
    try {
        const { type, value } = req.query;
        let query = {};

        if (value && value.trim() !== '') {
            if (type === 'name') {
                query.name = { $regex: value, $options: 'i' };
            } else if (type === 'regno') {
                query.regno = { $regex: value, $options: 'i' };
            }
        }

        const records = await Face.find(query).sort({ createdAt: -1 });
        res.json(records);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete record
app.delete('/api/records/:id', async (req, res) => {
    try {
        await Face.findByIdAndDelete(req.params.id);
        res.json({ message: 'Record deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});





// Get attendance by specific date
app.get('/api/attendance/date/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const attendanceLog = await AttendanceLog.findOne({ date });

        if (!attendanceLog) {
            // If no log exists for this date, create one with all absent
            const enrolledPersons = await Face.find({}, 'regno name');

            const absentRecords = enrolledPersons.map(person => ({
                regno: person.regno,
                name: person.name,
                status: 'absent'
            }));

            return res.json({
                date,
                attend: absentRecords
            });
        }

        res.json(attendanceLog);
    } catch (error) {
        console.error('Error fetching attendance by date:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});













// Get unknown person logs with time filter
app.get('/api/unknown-logs', async (req, res) => {
    try {
        const { filter } = req.query;
        let dateFilter = {};

        const now = new Date();

        if (filter === 'weekly') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            dateFilter = {
                time: { $gte: oneWeekAgo },
                title: 'unknown'
            };
        }
        else if (filter === 'monthly') {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            dateFilter = {
                time: { $gte: oneMonthAgo },
                title: 'unknown'
            };
        }
        else { // today (default)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dateFilter = {
                time: { $gte: today },
                title: 'unknown'
            };
        }

        const logs = await UnknownSpoofLog.find(dateFilter)
            .sort({ time: -1 }); // Newest first

        res.json(logs);
    } catch (error) {
        console.error('Error fetching unknown logs:', error);
        res.status(500).json({ error: 'Failed to fetch unknown person logs' });
    }
});








// Get spoofing detection logs with time filter
app.get('/api/spoofing-logs', async (req, res) => {
    try {
        const { filter2 } = req.query;
        let dateFilter2 = {};

        const now = new Date();

        if (filter2 === 'weekly2') {
            const oneWeekAgo2 = new Date();
            oneWeekAgo2.setDate(oneWeekAgo2.getDate() - 7);
            dateFilter2 = {
                time: { $gte: oneWeekAgo2 },
                title: 'spoofing'
            };
        }
        else if (filter2 === 'monthly2') {
            const oneMonthAgo2 = new Date();
            oneMonthAgo2.setMonth(oneMonthAgo2.getMonth() - 1);
            dateFilter2 = {
                time: { $gte: oneMonthAgo2 },
                title: 'spoofing'
            };
        }
        else { // today (default)
            const today2 = new Date();
            today2.setHours(0, 0, 0, 0);
            dateFilter2 = {
                time: { $gte: today2 },
                title: 'spoofing'
            };
        }

        const logs = await UnknownSpoofLog.find(dateFilter2)
            .sort({ time: -1 }); // Newest first

        res.json(logs);
    } catch (error) {
        console.error('Error fetching spoofing logs:', error);
        res.status(500).json({ error: 'Failed to fetch spoofing detection logs' });
    }
});



























function getCurrentDate() {
    // Get current date in local timezone (adjust hours if needed)
    const now = new Date();
    // If your server is UTC and you're in +5 timezone (for example)
    now.setHours(now.getHours() + 5); // Adjust this offset for your timezone
    return now.toISOString().split('T')[0];
}




async function initializeDailyAttendance() {
    const today = getCurrentDate();

    try {
        // Get all enrolled persons
        const enrolledPersons = await Face.find({}, 'regno name');
        
        // Get existing attendance log if it exists
        const existingLog = await AttendanceLog.findOne({ date: today });

        if (existingLog) {
            // Update existing log - only add new enrollees who aren't already in the log
            const existingRegNos = existingLog.attend.map(item => item.regno);
            const newEnrollees = enrolledPersons.filter(
                person => !existingRegNos.includes(person.regno)
            );

            if (newEnrollees.length > 0) {
                existingLog.attend.push(...newEnrollees.map(person => ({
                    regno: person.regno,
                    name: person.name,
                    status: 'absent' // New enrollees start as absent
                })));
                await existingLog.save();
                console.log(`Added ${newEnrollees.length} new enrollees to today's attendance`);
            }
        } else {
            // Create new attendance log with all marked absent (only if no log exists)
            const newAttendanceLog = new AttendanceLog({
                date: today,
                attend: enrolledPersons.map(person => ({
                    regno: person.regno,
                    name: person.name,
                    status: 'absent'
                }))
            });
            await newAttendanceLog.save();
            console.log(`Created new attendance log for ${today}`);
        }

        // Update the last initialized date
        await SystemSettings.findOneAndUpdate(
            { _id: 'attendance_tracker' },
            { lastInitializedDate: today },
            { upsert: true, new: true }
        );

    } catch (error) {
        console.error('Failed to initialize attendance:', error);
    }
}














const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await initializeDailyAttendance();
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
