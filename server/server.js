const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bodyParser = require('body-parser');

const SECRET = 'secret-key';
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(bodyParser.json());

// MySQL pool
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'voting_db'
});

// Middleware to check JWT
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Rate limiter
const voteLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  message: 'Too many votes, try again later'
});

// Anonymous auth
app.post('/auth/anon', (req, res) => {
  const userId = Math.random().toString(36).substr(2, 9);
  const token = jwt.sign({ userId }, SECRET, { expiresIn: '10m' });
  res.json({ token });
});

// Create poll
app.post('/poll', async (req, res) => {
  const { question, options, expiresAt } = req.body;
  const [result] = await db.query('INSERT INTO polls (question, expires_at) VALUES (?, ?)', [question, expiresAt]);
  const pollId = result.insertId;
  for (const option of options) {
    await db.query('INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)', [pollId, option]);
  }
  res.json({ pollId });
});

// Vote on poll
app.post('/poll/:id/vote', authMiddleware, voteLimiter, async (req, res) => {
  const pollId = req.params.id;
  const { optionId } = req.body;
  const userId = req.user.userId;

  const [existing] = await db.query('SELECT * FROM votes WHERE poll_id = ? AND user_id = ?', [pollId, userId]);
  if (existing.length > 0) return res.status(409).json({ message: 'Already voted' });

  const [poll] = await db.query('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll.length || new Date() > new Date(poll[0].expires_at)) {
    return res.status(403).json({ message: 'Poll expired' });
  }

  await db.query('INSERT INTO votes (user_id, poll_id, option_id) VALUES (?, ?, ?)', [userId, pollId, optionId]);
  const [[tally]] = await db.query('SELECT COUNT(*) as votes FROM votes WHERE option_id = ?', [optionId]);
  io.to(`poll-${pollId}`).emit('vote', { optionId, votes: tally.votes });
  res.json({ success: true });
});

// Get poll details
app.get('/poll/:id', async (req, res) => {
  const pollId = req.params.id;
  const [[poll]] = await db.query('SELECT * FROM polls WHERE id = ?', [pollId]);
  const [options] = await db.query(
    'SELECT o.id, o.option_text, COUNT(v.id) as votes FROM poll_options o LEFT JOIN votes v ON o.id = v.option_id WHERE o.poll_id = ? GROUP BY o.id',
    [pollId]
  );
  res.json({ ...poll, options });
});

// WebSocket connection
io.on('connection', (socket) => {
  socket.on('join', (pollId) => {
    socket.join(`poll-${pollId}`);
  });
});

server.listen(3001, () => console.log('Server running on http://localhost:3001'));
