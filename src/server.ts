import { Server } from "socket.io";

const io = new Server({ cors: { origin: "*" } });

const activeGames = [];
const matchMakingQueue = {};

const checkWinner = (board: string[]) => {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  const winner = winningCombinations.find((combination) => {
    const [a, b, c] = combination;
    return board[a] && board[a] === board[b] && board[a] === board[c];
  });

  return winner ? board[winner[0]] : null;
};

io.on("connect", (socket) => {
  console.log("New connection 🐒");

  matchMakingQueue[socket.id] = socket;

  socket.on("click", async (index) => {
    const roomId = Array.from(socket.rooms)[1];

    const game = activeGames.find((game) => game.gameId === roomId);

    const playerSign =
      game.player1.id === socket.id ? game.player1Sign : game.player2Sign;

    const turnSign = game.turn % 2 === 1 ? "X" : "O";

    if (playerSign !== turnSign) return;

    if (game) {
      game.board[index] = playerSign;
      game.turn = game.turn + 1;

      game.player2.emit("update_board", game.board);
      game.player1.emit("update_board", game.board);
    }

    const winner = checkWinner(game.board);

    // GAME_OVER
    if (winner) {
      game.player1.emit("game_over", winner);
      game.player2.emit("game_over", winner);

      activeGames.splice(activeGames.indexOf(game), 1);

      matchMakingQueue[game.player1.id] = game.player1;
      matchMakingQueue[game.player2.id] = game.player2;
    }
  });

  socket.on("disconnecting", () => {
    console.log("Connection closed 🐒");

    delete matchMakingQueue[socket.id];

    const roomId = Array.from(socket.rooms)[1];

    const game = activeGames.find((game) => game.gameId === roomId);

    if (!game) return;

    const anotherPlayer =
      game.player1.id === socket.id ? game.player2 : game.player1;

    if (game) {
      socket.to(roomId).emit("player_disconnect");

      activeGames.splice(activeGames.indexOf(game), 1);

      matchMakingQueue[anotherPlayer.id] = anotherPlayer;
    }
  });
});

// match making
setInterval(() => {
  const keys = Object.keys(matchMakingQueue);
  console.log(keys);
  if (keys.length > 1) {
    const player1 = matchMakingQueue[keys[0]];
    const player2 = matchMakingQueue[keys[1]];

    const gameId = `game_${player1.id}_${player2.id}`;

    const [player1Sign, player2Sign] =
      Math.random() > 0.5 ? ["X", "O"] : ["O", "X"];

    const game = {
      gameId,
      board: Array(9).fill(""),
      turn: 1,
      player1,
      player2,
      player1Sign,
      player2Sign,
    };

    player1.emit("start_game", {
      player: player1Sign,
      board: game.board,
      turn: 1,
    });

    player2.emit("start_game", {
      player: player2Sign,
      board: game.board,
      turn: 1,
    });

    activeGames.push(game);

    player1.join(gameId);
    player2.join(gameId);

    delete matchMakingQueue[keys[0]];
    delete matchMakingQueue[keys[1]];
  }
}, 1000);

const PORT = +process.env.PORT || 9000;

io.listen(PORT);
console.log("Server started 🚀");
