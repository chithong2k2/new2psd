const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const projectRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data', 'projects');
fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/projects', projectRoutes);

// Serve uploaded files (for image proxying in preview)
app.use('/data', express.static(path.join(__dirname, '..', 'data')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.listen(PORT, () => {
  console.log(`🚀 News2PSD server running at http://localhost:${PORT}`);
});

module.exports = app;
