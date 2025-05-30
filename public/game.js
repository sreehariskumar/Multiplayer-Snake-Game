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
let currentRoomId = null;
let gameOver = false;

socket.on('startGame', data => {
  currentRoomId = data.roomId;
  players = data.players;
  gameOver = false;

  let countdown = 5;
  const info = document.getElementById('info');
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

socket.on('prepareRematch', () => {
  const info = document.getElementById('info');
  let countdown = 5;
  const countdownInterval = setInterval(() => {
    if (countdown > 0) {
      info.innerHTML = `Rematch starting in ${countdown}...`;
      countdown--;
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);
});

socket.on('gameOver', ({ winner, scores }) => {
  gameOver = true;

  document.getElementById('info').textContent = winner
    ? (winner === socket.id ? 'You Win!' : 'You Lose!')
    : 'Game Over! It’s a tie.';

  const rematchDialog = document.createElement('div');
  rematchDialog.style.position = 'fixed';
  rematchDialog.style.top = '50%';
  rematchDialog.style.left = '50%';
  rematchDialog.style.transform = 'translate(-50%, -50%)';
  rematchDialog.style.backgroundColor = '#333';
  rematchDialog.style.padding = '20px';
  rematchDialog.style.borderRadius = '10px';
  rematchDialog.style.zIndex = '1000';
  rematchDialog.style.textAlign = 'center';
  rematchDialog.style.color = 'white';

  rematchDialog.innerHTML = `
    <h3>Rematch?</h3>
    <div style="display: flex; justify-content: center; gap: 20px; margin-top: 20px;">
      <button id="acceptRematch" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Yes</button>
      <button id="declineRematch" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">No</button>
    </div>
  `;

  document.body.appendChild(rematchDialog);

  document.getElementById('acceptRematch').addEventListener('click', () => {
    socket.emit('requestRematch', currentRoomId);
    rematchDialog.remove();
  });

  document.getElementById('declineRematch').addEventListener('click', () => {
    socket.emit('declineRematch', currentRoomId);
    rematchDialog.remove();
  });
});

socket.on('rematchRequested', (playerId) => {
  document.getElementById('info').innerHTML = `Opponent wants a rematch...`;
});

socket.on('rematchDeclined', () => {
  document.getElementById('info').textContent = `Opponent declined rematch.`;

  const leaveDialog = document.createElement('div');
  leaveDialog.style.position = 'fixed';
  leaveDialog.style.top = '50%';
  leaveDialog.style.left = '50%';
  leaveDialog.style.transform = 'translate(-50%, -50%)';
  leaveDialog.style.backgroundColor = '#333';
  leaveDialog.style.padding = '20px';
  leaveDialog.style.borderRadius = '10px';
  leaveDialog.style.zIndex = '1000';
  leaveDialog.style.textAlign = 'center';
  leaveDialog.style.color = 'white';

  leaveDialog.innerHTML = `
    <h3>Opponent declined rematch</h3>
    <button id="closeDialog" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 20px;">OK</button>
  `;

  document.body.appendChild(leaveDialog);

  document.getElementById('closeDialog').addEventListener('click', () => {
    leaveDialog.remove();
  });
});

socket.on('opponentDisconnected', () => {
  document.getElementById('info').textContent = `Opponent disconnected. Game over.`;
  gameOver = true;
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

  if (!gameOver) {
    checkCollision();
  }
});

function drawRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.fill();
}

function checkCollision() {
  const playerHead = snakes[socket.id]?.[0];

  Object.entries(snakes).forEach(([id, segments]) => {
    // Check self-collision
    if (id === socket.id) {
      for (let i = 1; i < segments.length; i++) {
        if (segments[i].x === playerHead.x && segments[i].y === playerHead.y) {
          socket.emit('playerCollision');
        }
      }
    } else {
      // Check collision with opponent
      segments.forEach(part => {
        if (part.x === playerHead.x && part.y === playerHead.y) {
          socket.emit('playerCollision');
        }
      });
    }
  });
}

function loop() {
  if (gameOver) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw fruit
  ctx.font = `${scale}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fruitEmoji, fruit.x * scale + scale / 2, fruit.y * scale + scale / 2);

  Object.keys(snakes).forEach(id => {
    const snake = snakes[id];
    if (!snake.length) return;

    ctx.fillStyle = players[id] || 'white';

    const head = snake[0];
    const body = snake.slice(1);
    const gap = 2;
    const bodySize = scale - gap;
    const radius = 6;

    // Draw head (slightly bigger)
    const headSize = scale - gap + 2;
    const headOffset = (scale - headSize) / 2;
    drawRoundedRect(
      head.x * scale + headOffset,
      head.y * scale + headOffset,
      headSize,
      headSize,
      radius
    );

    // Draw body segments with spacing
    body.forEach(part => {
      const x = part.x * scale + gap / 2;
      const y = part.y * scale + gap / 2;
      drawRoundedRect(x, y, bodySize, bodySize, radius);
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
