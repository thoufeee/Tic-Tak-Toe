import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory stores (replace with DB in production)
const playerSettings = new Map(); // key: playerId, value: { music: boolean, sound: boolean }

// Simple AI for tic-tac-toe: pick winning move, else block, else first empty
function computeBestMove(board, aiMark = 'O', humanMark = 'X') {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  const chooseWinOrBlock = (mark) => {
    for (const [a, b, c] of lines) {
      const line = [board[a], board[b], board[c]];
      const countMark = line.filter((v) => v === mark).length;
      const emptyIdx = [a, b, c].find((idx) => board[idx] === null || board[idx] === '');
      if (countMark === 2 && emptyIdx !== undefined) return emptyIdx;
    }
    return undefined;
  };
  let move = chooseWinOrBlock(aiMark);
  if (move !== undefined) return move;
  move = chooseWinOrBlock(humanMark);
  if (move !== undefined) return move;
  const empty = board.findIndex((v) => v === null || v === '');
  return empty === -1 ? undefined : empty;
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// AI move endpoint
app.post('/api/ai/move', (req, res) => {
  const { board, aiMark = 'O', humanMark = 'X' } = req.body ?? {};
  if (!Array.isArray(board) || board.length !== 9) {
    return res.status(400).json({ error: 'Invalid board' });
  }
  const move = computeBestMove(board, aiMark, humanMark);
  if (move === undefined) return res.status(200).json({ move: null });
  return res.json({ move });
});

// Player settings endpoints
app.post('/api/player', (_req, res) => {
  const playerId = randomUUID();
  playerSettings.set(playerId, { music: true, sound: true });
  res.json({ playerId, settings: playerSettings.get(playerId) });
});

app.get('/api/player/:id/settings', (req, res) => {
  const settings = playerSettings.get(req.params.id);
  if (!settings) return res.status(404).json({ error: 'Player not found' });
  res.json(settings);
});

app.put('/api/player/:id/settings', (req, res) => {
  const current = playerSettings.get(req.params.id);
  if (!current) return res.status(404).json({ error: 'Player not found' });
  const { music, sound } = req.body ?? {};
  const updated = {
    music: typeof music === 'boolean' ? music : current.music,
    sound: typeof sound === 'boolean' ? sound : current.sound,
  };
  playerSettings.set(req.params.id, updated);
  res.json(updated);
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Multiplayer via Socket.IO
const rooms = new Map(); // roomId -> { players: Set<socketId>, marks: Map<socketId, 'X'|'O'>, board: string[], turn: 'X'|'O', timerId?: NodeJS.Timeout, remaining?: number, over?: boolean }

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function isDraw(board) {
  return board.every((v) => v === 'X' || v === 'O');
}

function clearRoomTimer(room) {
  if (room.timerId) {
    clearInterval(room.timerId);
    room.timerId = undefined;
  }
}

function startTurnTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.over) return;
  clearRoomTimer(room);
  room.remaining = 30;
  room.timerId = setInterval(() => {
    if (!rooms.has(roomId)) return clearRoomTimer(room);
    room.remaining -= 1;
    io.to(roomId).emit('room:tick', { remaining: room.remaining });
    if (room.remaining <= 0) {
      // Auto-switch turn on timeout
      room.turn = room.turn === 'X' ? 'O' : 'X';
      io.to(roomId).emit('room:state', { board: room.board, turn: room.turn });
      // restart timer for next player
      startTurnTimer(roomId);
    }
  }, 1000);
}

io.on('connection', (socket) => {
  socket.on('room:create', (_payload, cb) => {
    const roomId = randomUUID().slice(0, 6);
    rooms.set(roomId, {
      players: new Set([socket.id]),
      marks: new Map([[socket.id, 'X']]),
      board: Array(9).fill(''),
      turn: 'X',
      remaining: 30,
    });
    socket.join(roomId);
    cb?.({ roomId, mark: 'X' });
  });

  socket.on('room:join', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.players.size >= 2) return cb?.({ error: 'Room full' });
    room.players.add(socket.id);
    room.marks.set(socket.id, 'O');
    socket.join(roomId);
    cb?.({ roomId, mark: 'O' });
    io.to(roomId).emit('room:state', {
      board: room.board,
      turn: room.turn,
    });
    // Start timer once two players present
    if (room.players.size === 2) startTurnTimer(roomId);
  });

  socket.on('game:move', ({ roomId, index }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });
    const mark = room.marks.get(socket.id);
    if (!mark) return cb?.({ error: 'Not in room' });
    if (room.players.size < 2) return cb?.({ error: 'Waiting for opponent' });
    if (room.board[index]) return cb?.({ error: 'Cell occupied' });
    if (room.turn !== mark) return cb?.({ error: 'Not your turn' });
    room.board[index] = mark;
    // Check game status
    const winner = checkWinner(room.board);
    if (winner) {
      room.over = true;
      clearRoomTimer(room);
      io.to(roomId).emit('room:game_over', { winner });
      return cb?.({ ok: true });
    }
    if (isDraw(room.board)) {
      room.over = true;
      clearRoomTimer(room);
      io.to(roomId).emit('room:game_over', { draw: true });
      return cb?.({ ok: true });
    }
    // Next turn and restart timer
    room.turn = mark === 'X' ? 'O' : 'X';
    io.to(roomId).emit('room:state', { board: room.board, turn: room.turn });
    startTurnTimer(roomId);
    cb?.({ ok: true });
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        room.marks.delete(socket.id);
        clearRoomTimer(room);
        io.to(roomId).emit('room:player_left');
        if (room.players.size === 0) rooms.delete(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 5174;
server.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`Backend listening on http://localhost:${PORT}`);
});


