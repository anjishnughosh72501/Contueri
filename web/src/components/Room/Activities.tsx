import React, { useState, useRef } from 'react';
import { ActivityState, DrawStroke } from '@contueri/shared';
import { getOrCreateClientId } from '../../hooks/useRoomSocket';

const PROMPT_BANK = [
  { q: 'Would you rather have infinite popcorn or infinite pizza?', opts: ['🍿 Popcorn forever', '🍕 Pizza forever'] },
  { q: 'Sci-Fi or Fantasy movies for tonight?', opts: ['🚀 Sci-Fi', '🧙 Fantasy'] },
  { q: 'Rewatch a classic or watch something totally new?', opts: ['📼 Rewatch a classic', '✨ Totally new'] },
  { q: 'Subtitles ON or Subtitles OFF?', opts: ['📝 Subtitles ON', '🔇 Subtitles OFF'] },
  { q: 'Binge the whole season or one episode per night?', opts: ['🛋️ Binge it all', '🌙 One a day'] },
  { q: 'Best watch-party snack?', opts: ['🍿 Popcorn', '🍫 Candy / Chocolate', '🍕 Pizza', '🥤 Soda / Juice'] },
];

interface ActivitiesProps {
  activity: ActivityState;
  onSetActivity: (type: 'poll' | 'tictactoe' | 'draw' | null) => void;
  onPollCreate: (question: string, options: string[]) => void;
  onPollVote: (optionIndex: number) => void;
  onPollClose: () => void;
  onTttJoin: (side: 'X' | 'O') => void;
  onTttMove: (index: number) => void;
  onTttReset: () => void;
  onDrawStroke: (stroke: DrawStroke) => void;
  onDrawClear: () => void;
}

export const Activities: React.FC<ActivitiesProps> = ({
  activity,
  onSetActivity,
  onPollCreate,
  onPollVote,
  onPollClose,
  onTttJoin,
  onTttMove,
  onTttReset,
  onDrawStroke,
  onDrawClear,
}) => {
  const myClientId = getOrCreateClientId();

  // Custom poll form state
  const [customQ, setCustomQ] = useState('');
  const [customOpt1, setCustomOpt1] = useState('');
  const [customOpt2, setCustomOpt2] = useState('');

  // Drawing canvas state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [drawColor, setDrawColor] = useState('#ffffff');
  const [drawWidth, setDrawWidth] = useState(3);

  // Poll vote calculations
  const poll = activity.poll;
  const pollTotalVotes = poll ? Object.keys(poll.votes).length : 0;
  const pollMyVote = poll ? poll.votes[myClientId] : undefined;

  // Tic-Tac-Toe helpers
  const ttt = activity.tictactoe;
  const mySide = ttt?.players.X === myClientId ? 'X' : ttt?.players.O === myClientId ? 'O' : null;
  const isMyTurn = ttt && ttt.turn === mySide && !ttt.winner;

  // Drawing canvas mouse/touch handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    currentPointsRef.current = [];
    const pt = getCanvasCoords(e);
    if (pt) currentPointsRef.current.push(pt);
  };

  const drawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pt = getCanvasCoords(e);
    if (!pt) return;

    currentPointsRef.current.push(pt);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = drawWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const pts = currentPointsRef.current;
        if (pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
        }
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawingRef.current && currentPointsRef.current.length > 0) {
      onDrawStroke({
        points: [...currentPointsRef.current],
        color: drawColor,
        width: drawWidth,
      });
    }
    isDrawingRef.current = false;
    currentPointsRef.current = [];
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.round(clientX - rect.left),
      y: Math.round(clientY - rect.top),
    };
  };

  const handleSaveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contueri-drawing.png';
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="sidebar-panel">
      <div className="activities-panel">
        {/* Activity picker tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          <button
            type="button"
            className={`btn-secondary ${activity.type === 'poll' ? 'btn-active' : ''}`}
            onClick={() => onSetActivity('poll')}
            style={{ fontSize: '0.75rem', flex: 1, padding: '0.4em' }}
          >
            📊 Polls
          </button>
          <button
            type="button"
            className={`btn-secondary ${activity.type === 'tictactoe' ? 'btn-active' : ''}`}
            onClick={() => onSetActivity('tictactoe')}
            style={{ fontSize: '0.75rem', flex: 1, padding: '0.4em' }}
          >
            ⭕ Tic-Tac-Toe
          </button>
          <button
            type="button"
            className={`btn-secondary ${activity.type === 'draw' ? 'btn-active' : ''}`}
            onClick={() => onSetActivity('draw')}
            style={{ fontSize: '0.75rem', flex: 1, padding: '0.4em' }}
          >
            🎨 Drawing
          </button>
        </div>

        {/* 1. POLLS */}
        {activity.type === 'poll' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {poll && !poll.closed ? (
              <div className="activity-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{poll.question}</h4>
                  <button
                    type="button"
                    onClick={onPollClose}
                    className="btn-secondary"
                    style={{ fontSize: '0.7rem', padding: '0.2em 0.5em' }}
                  >
                    Close Poll
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
                  {poll.options.map((opt, idx) => {
                    const voteCount = Object.values(poll.votes).filter((v) => v === idx).length;
                    const pct = pollTotalVotes > 0 ? Math.round((voteCount / pollTotalVotes) * 100) : 0;
                    const isSelected = pollMyVote === idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onPollVote(idx)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'var(--bg-secondary)',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          textAlign: 'left',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', zIndex: 1, width: '100%' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{opt}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {pct}% ({voteCount})
                          </span>
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${pct}%`,
                            background: 'rgba(99, 102, 241, 0.2)',
                            zIndex: 0,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', alignSelf: 'flex-end' }}>
                  {pollTotalVotes} {pollTotalVotes === 1 ? 'vote' : 'votes'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="activity-card">
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Quick "Would You Rather"</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {PROMPT_BANK.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="btn-secondary"
                        onClick={() => onPollCreate(p.q, p.opts)}
                        style={{ fontSize: '0.75rem', padding: '0.35em 0.6em', textAlign: 'left', justifyContent: 'flex-start' }}
                      >
                        💬 {p.q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="activity-card">
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Create Custom Poll</h4>
                  <input
                    type="text"
                    value={customQ}
                    onChange={(e) => setCustomQ(e.target.value)}
                    placeholder="Poll question (e.g. Favorite genre?)"
                    maxLength={120}
                    style={{ fontSize: '0.85rem' }}
                  />
                  <input
                    type="text"
                    value={customOpt1}
                    onChange={(e) => setCustomOpt1(e.target.value)}
                    placeholder="Option 1"
                    maxLength={40}
                    style={{ fontSize: '0.85rem' }}
                  />
                  <input
                    type="text"
                    value={customOpt2}
                    onChange={(e) => setCustomOpt2(e.target.value)}
                    placeholder="Option 2"
                    maxLength={40}
                    style={{ fontSize: '0.85rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customQ.trim() && customOpt1.trim() && customOpt2.trim()) {
                        onPollCreate(customQ.trim(), [customOpt1.trim(), customOpt2.trim()]);
                        setCustomQ('');
                        setCustomOpt1('');
                        setCustomOpt2('');
                      }
                    }}
                    disabled={!customQ.trim() || !customOpt1.trim() || !customOpt2.trim()}
                    style={{ fontSize: '0.85rem', padding: '0.4em' }}
                  >
                    Start Poll
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. TIC-TAC-TOE */}
        {activity.type === 'tictactoe' && ttt && (
          <div className="activity-card" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tic-Tac-Toe</h4>
              <button
                type="button"
                className="btn-secondary"
                onClick={onTttReset}
                style={{ fontSize: '0.7rem', padding: '0.2em 0.5em' }}
              >
                ↻ New Game
              </button>
            </div>

            <div style={{ display: 'flex', gap: '1rem', margin: '0.5rem 0', fontSize: '0.85rem' }}>
              <div>
                <strong>Player X: </strong>
                {ttt.players.X ? (
                  <span>{ttt.players.XName}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onTttJoin('X')}
                    style={{ fontSize: '0.7rem', padding: '0.2em 0.5em' }}
                  >
                    Play as X
                  </button>
                )}
              </div>
              <div>
                <strong>Player O: </strong>
                {ttt.players.O ? (
                  <span>{ttt.players.OName}</span>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onTttJoin('O')}
                    style={{ fontSize: '0.7rem', padding: '0.2em 0.5em' }}
                  >
                    Play as O
                  </button>
                )}
              </div>
            </div>

            {ttt.winner ? (
              <p style={{ color: 'var(--success)', fontWeight: 700, margin: '0.35rem 0' }}>
                {ttt.winner === 'draw' ? '🤝 It is a draw!' : `🎉 Winner: ${ttt.winner}!`}
              </p>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Turn: <strong>{ttt.turn}</strong> {isMyTurn ? '(Your move!)' : ''}
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 60px)',
                gridTemplateRows: 'repeat(3, 60px)',
                gap: '6px',
                marginTop: '0.5rem',
              }}
            >
              {ttt.board.map((cell, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onTttMove(idx)}
                  disabled={!!cell || !!ttt.winner || !isMyTurn}
                  style={{
                    width: '60px',
                    height: '60px',
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    background: cell ? 'var(--bg-secondary)' : 'var(--bg-card)',
                    color: cell === 'X' ? '#38bdf8' : '#f43f5e',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: cell || ttt.winner || !isMyTurn ? 'default' : 'pointer',
                  }}
                >
                  {cell || ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. SHARED DRAWING BOARD */}
        {activity.type === 'draw' && (
          <div className="activity-card" style={{ padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Shared Whiteboard</h4>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onDrawClear}
                  style={{ fontSize: '0.7rem', padding: '0.2em 0.5em' }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSaveDrawing}
                  style={{ fontSize: '0.7rem', padding: '0.2em 0.5em' }}
                >
                  Save PNG
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', margin: '0.4rem 0' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Color:</span>
              {['#ffffff', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ec4899'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDrawColor(c)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: drawColor === c ? '2px solid #fff' : 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                />
              ))}
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.4rem' }}>Size:</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDrawWidth(2)}
                style={{ padding: '0.1em 0.35em', fontSize: '0.7rem' }}
              >
                S
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDrawWidth(5)}
                style={{ padding: '0.1em 0.35em', fontSize: '0.7rem' }}
              >
                M
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDrawWidth(10)}
                style={{ padding: '0.1em 0.35em', fontSize: '0.7rem' }}
              >
                L
              </button>
            </div>

            <canvas
              ref={canvasRef}
              width={280}
              height={260}
              onMouseDown={startDrawing}
              onMouseMove={drawMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={drawMove}
              onTouchEnd={stopDrawing}
              style={{
                width: '100%',
                height: '260px',
                background: '#0f172a',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                touchAction: 'none',
                cursor: 'crosshair',
              }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textAlign: 'center', marginTop: '0.2rem' }}>
              Drawings are live and ephemeral. Save as PNG to keep your artwork!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
