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
  document.getElementById('info').textContent = `Room created! Share this Room ID with your friend: ${roomId}`;
});

socket.on('roomFullOrInvalid', () => {
  document.getElementById('info').textContent = `Room full or invalid. Try again.`;
});

let snakes = {};
let fruit = {};
let scores = {};
let startTime = null;
let players = {};

socket.on('startGame', data => {
  players = data.players;

  let countdown = 5;
  const info = document.getElementById('info');

  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      info.textContent = `You are ${players[socket.id]} snake | Starting in ${countdown}...`;
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

document.querySelectorAll('.control-button').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.getAttribute('data-dir');
    const dir = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 }
    }[key];

    if (dir) {
      socket.emit('direction', dir);
    }
  });
});

socket.on('gameState', (state) => {
  snakes = state.snakes;
  fruit = state.fruit;
  scores = state.scores;
});

socket.on('gameOver', ({ winner, scores }) => {
  document.getElementById('info').textContent = winner
    ? (winner === socket.id ? 'You Win!' : 'You Lose!')
    : 'Game Over! It’s a tie.';
});

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw fruit as 🍎
  ctx.font = `${scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("🍎", fruit.x * scale + scale / 2, fruit.y * scale + scale / 2);

  Object.keys(snakes).forEach(id => {
    ctx.fillStyle = players[id] || 'white';
    snakes[id].forEach(part => {
      ctx.fillRect(part.x * scale, part.y * scale, scale, scale);
    });
  });

  // Draw scores
  Object.keys(snakes).forEach(id => {
    ctx.fillStyle = 'white';
    ctx.font = `16px Arial`;
    ctx.textBaseline = 'top';

    if (id === socket.id) {
      ctx.textAlign = 'left';
      ctx.fillText(`Player You: ${scores[id]}`, 10, 10);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(`Player Opponent: ${scores[id]}`, canvas.width - 10, 10);
    }
  });

  if (Date.now() - startTime < 5 * 60 * 1000) {
    requestAnimationFrame(loop);
  }
}
