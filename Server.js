const express = require('express');
const app = express();
app.use(express.json());

// Store reports in memory (for hackathon demo)
let studentReports = {};

// ============================================================
// Android app posts usage reports here
// ============================================================
app.post('/api/usage-report', (req, res) => {
    const report = req.body;
    const studentId = report.student_id;

    if (!studentId) {
        return res.status(400).json({ error: 'Missing student_id' });
    }

    // Store latest report per student
    if (!studentReports[studentId]) {
        studentReports[studentId] = {
            student_id: studentId,
            student_name: report.student_name,
            student_class: report.student_class,
            device_id: report.device_id,
            logs: []
        };
    }

    // Append usage logs
    if (report.usage_logs && Array.isArray(report.usage_logs)) {
        studentReports[studentId].logs.push(...report.usage_logs);
    }

    studentReports[studentId].last_seen = report.report_time;

    console.log(`Report received from: ${report.student_name} (${studentId})`);
    res.json({ status: 'ok', message: 'Report received' });
});

// ============================================================
// Admin dashboard fetches all students from here
// ============================================================
app.get('/api/students', (req, res) => {
    const students = Object.values(studentReports).map(s => {
        const logs = s.logs || [];

        // Calculate social media time
        const socialLogs = logs.filter(l => l.is_social_media);
        const socialSeconds = socialLogs.reduce((sum, l) => sum + (l.screen_time_seconds || 0), 0);
        const socialMinutes = Math.round(socialSeconds / 60);

        // Total screen time
        const totalSeconds = logs.reduce((sum, l) => sum + (l.screen_time_seconds || 0), 0);
        const totalMinutes = Math.round(totalSeconds / 60);

        // Top app
        const appCount = {};
        logs.forEach(l => {
            if (l.package) appCount[l.package] = (appCount[l.package] || 0) + 1;
        });
        const topApp = Object.keys(appCount).sort((a, b) => appCount[b] - appCount[a])[0] || 'None';
        const topAppSimple = topApp.split('.').pop();

        // Usage level
        let level = 'low';
        if (socialMinutes > 120) level = 'high';
        else if (socialMinutes > 30) level = 'medium';

        return {
            id: s.student_id,
            name: s.student_name,
            cls: s.student_class,
            screen: formatTime(totalMinutes),
            social: formatTime(socialMinutes),
            socialMins: socialMinutes,
            top: topAppSimple,
            level: level,
            last: s.last_seen || 'unknown'
        };
    });

    res.json(students);
});

// ============================================================
// Health check
// ============================================================
app.get('/', (req, res) => {
    res.json({
        status: 'Campus Student Tracker Server is running!',
        students_registered: Object.keys(studentReports).length
    });
});

function formatTime(minutes) {
    if (minutes < 60) return minutes + ' min';
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Admin dashboard: http://localhost:${PORT}/api/students`);
});