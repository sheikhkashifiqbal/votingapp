const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Allow cross-origin requests

const PORT = 5000;

app.get('/api/message', (req, res) => {
  res.json({ message: 'Hello from Node.js backend!' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Node.js backend!' });
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
