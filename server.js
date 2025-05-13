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

      room.forEach(s => s.emit('startGame', roomId));
      setupGame(room, roomId);
    } else {
      socket.emit('roomFullOrInvalid');
    }
  });

  const setupGame = (room, roomId) => {
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

    room.forEach(socket => {
      socket.on('direction', (dir) => {
        directions[socket.id] = dir;
      });
    });

    const interval = setInterval(() => {
      for (let id in snakes) {
        const snake = snakes[id];
        const dir = directions[id];
        const head = { ...snake[0] };

        head.x = (head.x + dir.x + 40) % 40;
        head.y = (head.y + dir.y + 30) % 30;

        snake.unshift(head);

        if (head.x === fruit.x && head.y === fruit.y) {
          fruit.x = Math.floor(Math.random() * 40);
          fruit.y = Math.floor(Math.random() * 30);
          scores[id]++;
        } else {
          snake.pop();
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

    setTimeout(() => {
      clearInterval(interval);
      const winner =
        scores[room[0].id] > scores[room[1].id]
          ? room[0].id
          : scores[room[0].id] < scores[room[1].id]
          ? room[1].id
          : null;

      room.forEach(s =>
        s.emit('gameOver', {
          winner,
          scores
        })
      );

      delete rooms[roomId];
    }, 300000); // 5 mins
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