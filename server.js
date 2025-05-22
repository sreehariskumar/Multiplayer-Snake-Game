const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(express.static('public'));

let rooms = {};
const fruitEmojis = ['🍎','🍏','🍐','🍊','🍇','🍓','🫐','🍉','🍌','🥑','🍍','🍒'];

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = uuidv4();
    rooms[roomId] = {
      players: [socket],
      rematchRequests: new Set()
    };
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];

    if (room && room.players.length < 2) {
      room.players.push(socket);
      socket.join(roomId);

      const players = {
        [room.players[0].id]: 'green',
        [room.players[1].id]: 'blue'
      };

      room.players.forEach(s => s.emit('startGame', { roomId, players }));
      setupGame(room, roomId, players);
    } else {
      socket.emit('roomFullOrInvalid');
    }
  });

  socket.on('requestRematch', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.rematchRequests.add(socket.id);
      room.players.forEach(s => s.emit('rematchRequested', socket.id));

      if (room.rematchRequests.size === 2) {
        room.rematchRequests.clear();
        startRematch(room, roomId);
      }
    }
  });

  socket.on('declineRematch', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.players.forEach(s => s.emit('rematchDeclined'));
      delete rooms[roomId];
    }
  });

  const startRematch = (room, roomId) => {
    const players = {
      [room.players[0].id]: 'green',
      [room.players[1].id]: 'blue'
    };
    
    room.players.forEach(s => s.emit('prepareRematch'));
    
    setTimeout(() => {
      room.players.forEach(s => s.emit('startGame', { roomId, players }));
      setupGame(room, roomId, players);
    }, 5000);
  };

  const setupGame = (room, roomId, players) => {
    let fruit = randomPosition();
    let fruitEmoji = randomFruit();
    const scores = {};

    const snakes = {
      [room.players[0].id]: createSnake(),
      [room.players[1].id]: createSnake()
    };

    scores[room.players[0].id] = 0;
    scores[room.players[1].id] = 0;

    const directions = {
      [room.players[0].id]: { x: 1, y: 0 },
      [room.players[1].id]: { x: 1, y: 0 }
    };

    const lastDirections = { ...directions };

    room.players.forEach(socket => {
      socket.on('direction', (dir) => {
        const last = lastDirections[socket.id];
        if ((dir.x !== -last.x || dir.y !== -last.y)) {
          directions[socket.id] = dir;
        }
      });
    });

    const interval = setInterval(() => {
      const newHeads = {};
      for (let id in snakes) {
        const snake = snakes[id];
        const dir = directions[id];
        const head = { ...snake[0] };

        head.x = (head.x + dir.x + 40) % 40;
        head.y = (head.y + dir.y + 30) % 30;
        newHeads[id] = head;
      }

      // Check collisions
      for (let id in newHeads) {
        const head = newHeads[id];

        // Self collision
        if (snakes[id].some((seg, idx) => idx !== 0 && seg.x === head.x && seg.y === head.y)) {
          endGame(room, roomId, id === room.players[0].id ? room.players[1].id : room.players[0].id, scores, interval);
          return;
        }

        // Collision with opponent
        const otherId = id === room.players[0].id ? room.players[1].id : room.players[0].id;
        if (snakes[otherId].some(seg => seg.x === head.x && seg.y === head.y)) {
          endGame(room, roomId, otherId, scores, interval);
          return;
        }
      }

      for (let id in snakes) {
        snakes[id].unshift(newHeads[id]);
        lastDirections[id] = directions[id];

        if (newHeads[id].x === fruit.x && newHeads[id].y === fruit.y) {
          fruit = randomPosition();
          fruitEmoji = randomFruit();
          scores[id]++;
        } else {
          snakes[id].pop();
        }
      }

      room.players.forEach(s => {
        s.emit('gameState', {
          snakes,
          fruit,
          fruitEmoji,
          scores
        });
      });

    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      const scoreA = scores[room.players[0].id];
      const scoreB = scores[room.players[1].id];
      const winner =
        scoreA > scoreB ? room.players[0].id : scoreB > scoreA ? room.players[1].id : null;

      room.players.forEach(s =>
        s.emit('gameOver', {
          winner,
          scores
        })
      );
    }, 300000); // 5 minutes
  };

  const endGame = (room, roomId, winnerId, scores, interval) => {
    clearInterval(interval);
    room.players.forEach(s =>
      s.emit('gameOver', {
        winner: winnerId,
        scores
      })
    );
  };

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const otherPlayer = room.players[1 - index];
        if (otherPlayer) {
          otherPlayer.emit('opponentDisconnected');
        }
        delete rooms[roomId];
        break;
      }
    }
  });
});

const createSnake = () => [
  { x: Math.floor(Math.random() * 40), y: Math.floor(Math.random() * 30) }
];

const randomPosition = () => ({
  x: Math.floor(Math.random() * 40),
  y: Math.floor(Math.random() * 30)
});

const randomFruit = () => fruitEmojis[Math.floor(Math.random() * fruitEmojis.length)];

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
