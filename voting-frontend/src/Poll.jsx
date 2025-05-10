import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

export default function Poll({ pollId }) {
  const [poll, setPoll] = useState(null);
  const [token, setToken] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await axios.post('http://localhost:3001/auth/anon');
      setToken(data.token);

      const res = await axios.get(`http://localhost:3001/poll/${pollId}`);
      setPoll(res.data);

      socket.emit('join', pollId);
      socket.on('vote', ({ optionId, votes }) => {
        setPoll((prev) => ({
          ...prev,
          options: prev.options.map((opt) =>
            opt.id === optionId ? { ...opt, votes } : opt
          ),
        }));
      });
    })();
  }, [pollId]);

  const castVote = async () => {
    if (!selected || !token) return;
    await axios.post(
      `http://localhost:3001/poll/${pollId}/vote`,
      { optionId: selected },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  if (!poll) return <div>Loading...</div>;

  return (
    <>
      <h2>{poll.question}</h2>
      {poll.options.map((opt) => (
        <div key={opt.id}>
          <label>
            <input type="radio" name="vote" value={opt.id} onChange={() => setSelected(opt.id)} />
            {opt.option_text} - {opt.votes} votes
            <progress value={opt.votes} max={Math.max(...poll.options.map(o => o.votes), 1)} />
          </label>
        </div>
      ))}
      <button onClick={castVote}>Vote</button>
    </>
  );
}
