import { TicTacToeState, PollState } from '@contueri/shared';

export function createInitialTicTacToe(): TicTacToeState {
  return {
    board: Array(9).fill(null),
    turn: 'X',
    players: { X: null, O: null },
    winner: null,
  };
}

export function checkTicTacToeWinner(board: ('X' | 'O' | null)[]): 'X' | 'O' | 'draw' | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell !== null)) {
    return 'draw';
  }
  return null;
}

export function createPoll(id: string, question: string, options: string[], creatorId: string): PollState {
  return {
    id,
    question: question.trim().slice(0, 120),
    options: options.map(o => o.trim().slice(0, 40)).filter(Boolean).slice(0, 4),
    votes: {},
    creatorId,
    closed: false,
  };
}
