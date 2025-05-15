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

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('createRoom', () => {
    const roomId = uuidv4();
    rooms[roomId] = [socket];
    socket.join(roomId);
    socket.emit('roomCreated', roomId);
  });

  socket.on('joinRoom', (roomId) => {
    const room = rooms[roomId];

    if (room && room.length < 2) {
      room.push(socket);
      socket.join(roomId);

      const players = {
        [room[0].id]: 'lime',
        [room[1].id]: 'cyan'
      };

      room.forEach(s => s.emit('startGame', { roomId, players }));
      setupGame(room, roomId, players);
    } else {
      socket.emit('roomFullOrInvalid');
    }
  });

  const setupGame = (room, roomId, players) => {
    const fruit = randomPosition();
    const scores = { };

    const snakes = {
      [room[0].id]: createSnake(),
      [room[1].id]: createSnake()
    };

    scores[room[0].id] = 0;
    scores[room[1].id] = 0;

    const directions = {
      [room[0].id]: { x: 1, y: 0 },
      [room[1].id]: { x: 1, y: 0 }
    };

    const lastDirections = { ...directions };

    room.forEach(socket => {
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

      // Check collision
      const allPositions = Object.values(snakes).flat();
      for (let id in newHeads) {
        const head = newHeads[id];

        // Check self collision
        if (snakes[id].some((seg, idx) => idx !== 0 && seg.x === head.x && seg.y === head.y)) {
          endGame(room, roomId, id === room[0].id ? room[1].id : room[0].id, scores, interval);
          return;
        }

        // Check collision with other snake
        const otherId = id === room[0].id ? room[1].id : room[0].id;
        if (snakes[otherId].some(seg => seg.x === head.x && seg.y === head.y)) {
          endGame(room, roomId, otherId, scores, interval);
          return;
        }
      }

      for (let id in snakes) {
        snakes[id].unshift(newHeads[id]);
        lastDirections[id] = directions[id];

        if (newHeads[id].x === fruit.x && newHeads[id].y === fruit.y) {
          fruit.x = Math.floor(Math.random() * 40);
          fruit.y = Math.floor(Math.random() * 30);
          scores[id]++;
        } else {
          snakes[id].pop();
        }
      }

      room.forEach(s => {
        s.emit('gameState', {
          snakes,
          fruit,
          scores
        });
      });

    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      const scoreA = scores[room[0].id];
      const scoreB = scores[room[1].id];
      const winner =
        scoreA > scoreB ? room[0].id : scoreB > scoreA ? room[1].id : null;

      room.forEach(s =>
        s.emit('gameOver', {
          winner,
          scores
        })
      );
      delete rooms[roomId];
    }, 300000); // 5 mins
  };

  const endGame = (room, roomId, winnerId, scores, interval) => {
    clearInterval(interval);
    room.forEach(s =>
      s.emit('gameOver', {
        winner: winnerId,
        scores
      })
    );
    delete rooms[roomId];
  };
});

const createSnake = () => [
  { x: Math.floor(Math.random() * 40), y: Math.floor(Math.random() * 30) }
];

const randomPosition = () => ({
  x: Math.floor(Math.random() * 40),
  y: Math.floor(Math.random() * 30)
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});