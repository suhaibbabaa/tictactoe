const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let games = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', (gameCode) => {
    if (games[gameCode]) {
      socket.emit('errorMsg', 'Game code already exists');
      return;
    }
    games[gameCode] = {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      gameActive: true,
    };
    socket.join(gameCode);
    socket.emit('gameCreated', gameCode);
  });

  socket.on('joinGame', (gameCode) => {
    const game = games[gameCode];
    if (!game) {
      socket.emit('errorMsg', 'Game not found');
      return;
    }
    if (game.players.length >= 2) {
      socket.emit('errorMsg', 'Game full');
      return;
    }
    game.players.push(socket.id);
    socket.join(gameCode);
    io.to(gameCode).emit('startGame', { gameCode, board: game.board, currentPlayer: game.currentPlayer });
  });

  socket.on('makeMove', ({ gameCode, index }) => {
    const game = games[gameCode];
    if (!game || !game.gameActive) return;

    const playerIndex = game.players.indexOf(socket.id);
    const expectedPlayer = game.currentPlayer === 'X' ? 0 : 1;
    if (playerIndex !== expectedPlayer) return;

    if (game.board[index] !== null) return;

    game.board[index] = game.currentPlayer;

    if (checkWinner(game.board)) {
      io.to(gameCode).emit('gameOver', { winner: game.currentPlayer, board: game.board });
      game.gameActive = false;
      return;
    }

    if (game.board.every(cell => cell !== null)) {
      io.to(gameCode).emit('gameOver', { winner: null, board: game.board });
      game.gameActive = false;
      return;
    }

    game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
    io.to(gameCode).emit('updateBoard', { board: game.board, currentPlayer: game.currentPlayer });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const code in games) {
      const game = games[code];
      if (game.players.includes(socket.id)) {
        io.to(code).emit('opponentLeft');
        delete games[code];
      }
    }
  });
});

function checkWinner(board) {
  const winPatterns = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  return winPatterns.some(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
