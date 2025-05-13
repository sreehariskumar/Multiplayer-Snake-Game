const socket = io();
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scale = 20;

document.getElementById('createRoom').onclick = () => {
  socket.emit('createRoom');
};

document.getElementById('joinRoom').onclick = () => {
  const roomId = document.getElementById('roomIdInput').value;
  socket.emit('joinRoom', roomId);
};

socket.on('roomCreated', roomId => {
  document.getElementById('info').textContent = `Room created! Share this Room ID to invite: ${roomId}`;
});

socket.on('roomFullOrInvalid', () => {
  document.getElementById('info').textContent = `Room full or invalid. Try again.`;
});

let snakes = {};
let fruit = {};
let scores = {};
let startTime = null;

socket.on('startGame', roomId => {
  let countdown = 3;
  const info = document.getElementById('info');

  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      info.textContent = `Controls: Arrow Keys ← ↑ → ↓ | Starting in ${countdown}...`;
      countdown--;
    } else {
      clearInterval(countdownInterval);
      info.textContent = `Game Started!`;
      startTime = Date.now();
      requestAnimationFrame(loop);
    }
  }, 1000);
});

document.addEventListener('keydown', (e) => {
  const dir = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
  }[e.key];

  if (dir) {
    socket.emit('direction', dir);
  }
});

socket.on('gameState', (state) => {
  snakes = state.snakes;
  fruit = state.fruit;
  scores = state.scores;
});

socket.on('gameOver', ({ winner, scores }) => {
  document.getElementById('info').textContent = winner
    ? `Game Over! Winner: ${winner}`
    : 'Game Over! It’s a tie.';
});

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw fruit
  ctx.fillStyle = 'red';
  ctx.fillRect(fruit.x * scale, fruit.y * scale, scale, scale);

  // Draw snakes
  Object.keys(snakes).forEach(id => {
    ctx.fillStyle = id === socket.id ? 'lime' : 'cyan';
    snakes[id].forEach(part => {
      ctx.fillRect(part.x * scale, part.y * scale, scale, scale);
    });

    // Score
    ctx.fillStyle = 'white';
    ctx.fillText(`Player ${id === socket.id ? 'You' : 'Opponent'}: ${scores[id]}`, id === socket.id ? 10 : 650, 20);
  });

  if (Date.now() - startTime < 5 * 60 * 1000) {
    requestAnimationFrame(loop);
  }
}