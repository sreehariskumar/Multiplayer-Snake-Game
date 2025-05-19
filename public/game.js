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
  const info = document.getElementById('info');
  info.innerHTML = `
    <div id="roomInfoBox" style="margin-top: 10px;">
      <div>Room created! Share this Room ID with your friend:</div>
      <div style="margin: 8px 0;">
        <span id="roomId" style="font-weight: bold;">${roomId}</span>
        <button id="copyBtn" title="Copy Room ID" style="margin-left: 8px; cursor: pointer;">📋</button>
      </div>
      <div style="color: yellow; font-size: 14px;">⚠️ Don't refresh the page!</div>
    </div>
  `;

  document.getElementById('copyBtn').onclick = () => {
    const text = document.getElementById('roomId').textContent;
    navigator.clipboard.writeText(text).then(() => {
      document.getElementById('copyBtn').textContent = '✅';
      setTimeout(() => {
        document.getElementById('copyBtn').textContent = '📋';
      }, 1000);
    });
  };
});

socket.on('roomFullOrInvalid', () => {
  document.getElementById('info').textContent = `Room full or invalid. Try again.`;
});

let snakes = {};
let fruit = {};
let fruitEmoji = '🍎';
let scores = {};
let startTime = null;
let players = {};

socket.on('startGame', data => {
  players = data.players;

  let countdown = 5;
  const info = document.getElementById('info');

  // Remove room info box if present
  const roomInfoBox = document.getElementById('roomInfoBox');
  if (roomInfoBox) roomInfoBox.remove();

  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      const color = players[socket.id];
      const colorText = `<span style="color: ${color};">${color}</span>`;
      info.innerHTML = `You are ${colorText} snake | Starting in ${countdown}...`;
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
  fruitEmoji = state.fruitEmoji;
  scores = state.scores;
});

socket.on('gameOver', ({ winner, scores }) => {
  document.getElementById('info').textContent = winner
    ? (winner === socket.id ? 'You Win!' : 'You Lose!')
    : 'Game Over! It’s a tie.';
});

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw fruit
  ctx.font = `${scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fruitEmoji, fruit.x * scale + scale / 2, fruit.y * scale + scale / 2);

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
      ctx.fillText(`Player You - Score: ${scores[id]}`, 10, 10);
    } else {
      ctx.textAlign = 'right';
      ctx.fillText(`Opponent - Score: ${scores[id]}`, canvas.width - 10, 10);
    }
  });

  requestAnimationFrame(loop);
}
