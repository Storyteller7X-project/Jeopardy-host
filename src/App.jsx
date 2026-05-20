import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PASSWORD = "Ace_MyBeloved8*";
const PLAYER_COLORS = ["#3b82f6","#ef4444","#22c55e","#a855f7","#f97316","#ec4899","#eab308","#14b8a6"];
const PTS = [100, 200, 300, 400, 500];
const uid = () => Math.random().toString(36).slice(2, 10);

// ─── Storage ──────────────────────────────────────────────────────────────────
const sGet = async k => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const sSet = async (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const sDel = async k => { try { localStorage.removeItem(k); } catch {} };

// ─── Data helpers ─────────────────────────────────────────────────────────────
const ROUND_NAMES = { 2: ["Final"], 4: ["Semifinal 1", "Semifinal 2", "Final"] };

const freshRound = (name = "Round 1") => ({
  id: uid(), name,
  miniGames: ["trivia"],
  trivia: { topicCount: 2, questionsPerTopic: 5, questionTime: 25, topics: [] },
  associations: { puzzles: [] },
  buildacard: { rounds: [] },
  connections: { rounds: [] }
});

const freshShowRounds = (playerCount) =>
  (ROUND_NAMES[playerCount] || ["Round 1"]).map(name => freshRound(name));

const freshShow = () => ({
  id: uid(), name: "New Show", createdAt: Date.now(), updatedAt: Date.now(),
  playerCount: 4,
  rounds: freshShowRounds(4)
});

const normaliseShow = show => {
  const rounds = show.rounds?.length
    ? show.rounds.map(r => ({ buildacard: { rounds: [] }, connections: { rounds: [] }, miniGames: show.miniGames || ["trivia"], ...r }))
    : [{ id: uid(), name: "Round 1", miniGames: show.miniGames || ["trivia"], trivia: show.trivia || freshRound().trivia, associations: show.associations || freshRound().associations, buildacard: { rounds: [] }, connections: { rounds: [] } }];
  return { playerCount: 4, ...show, rounds };
};

function syncTopics(tr) {
  let ts = [...(tr.topics || [])];
  while (ts.length < tr.topicCount) ts.push({ id: uid(), name: "", questions: [] });
  ts = ts.slice(0, tr.topicCount).map(t => {
    let qs = [...(t.questions || [])];
    while (qs.length < tr.questionsPerTopic) qs.push({ id: uid(), text: "", points: PTS[Math.min(qs.length, PTS.length - 1)] });
    return { ...t, questions: qs.slice(0, tr.questionsPerTopic) };
  });
  return { ...tr, topics: ts };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard(tr, assoc, bac, conn, miniGames) {
  const safeTr = tr || { topicCount: 0, questionsPerTopic: 0, topics: [] };
  const safeAssoc = assoc || { puzzles: [] };
  const safeBac = bac || { rounds: [] };
  const safeConn = conn || { rounds: [] };
  const mg = miniGames || [];

  const triviaColumns = mg.includes("trivia")
    ? syncTopics(safeTr).topics.map(t => ({
        name: t.name || "—", type: "trivia",
        qs: [...t.questions].sort((a, b) => a.points - b.points).map(q => ({ id: q.id, text: q.text, answer: q.answer || "", points: q.points, imageUrl: q.imageUrl || null, done: false }))
      }))
    : [];

  const puzzles = (safeAssoc?.puzzles || []).filter(p => p.answer && p.branches?.length > 0);
  const assocColumn = mg.includes("associations") && puzzles.length ? {
    name: "Associations", type: "assoc",
    qs: puzzles.map(p => ({
      id: p.id, type: "assoc",
      answer: p.answer,
      branches: p.branches.map(b => (b.words || []).filter(w => w.trim())),
      points: p.points || p.basePoints || 500,
      revealedCells: [], centerRevealed: false, done: false
    }))
  } : null;

  const bacRounds = (safeBac.rounds || []).filter(r => r.numbers?.length || r.keywords?.length);
  const bacColumn = mg.includes("buildacard") && bacRounds.length ? {
    name: "Build-a-Card", type: "buildacard",
    qs: bacRounds.map(r => ({
      id: r.id, type: "buildacard",
      numbers: r.numbers || [],
      keywords: r.keywords || [],
      imageUrl: r.imageUrl || null,
      assigned: { mana: null, attack: null, health: null, keywords: [] },
      done: false
    }))
  } : null;

  const connRounds = (safeConn.rounds || []).filter(r => r.pairs?.some(p => p.a && p.b));
  const connColumn = mg.includes("connections") && connRounds.length ? {
    name: "Connections", type: "connections",
    qs: connRounds.map(r => {
      const validPairs = r.pairs.filter(p => p.a && p.b);
      return {
        id: r.id, type: "connections",
        pairs: validPairs,
        colA: shuffle(validPairs.map(p => ({ pairId: p.id, word: p.a }))),
        colB: shuffle(validPairs.map(p => ({ pairId: p.id, word: p.b }))),
        matched: [],      // array of pairIds correctly matched
        selectedA: null,  // pairId currently selected in col A
        lastResult: null, // { pairId, correct } brief flash
        done: false
      };
    })
  } : null;

  return [
    ...triviaColumns,
    ...(assocColumn ? [assocColumn] : []),
    ...(bacColumn ? [bacColumn] : []),
    ...(connColumn ? [connColumn] : [])
  ];
}

function buildBracket(players) {
  const mk = (a, b) => ({ id: uid(), p1: a?.id ?? null, p2: b?.id ?? null, w: null });
  const n = players.length;
  if (n === 2) return [[mk(players[0], players[1])]];
  if (n === 4) return [[mk(players[0], players[1]), mk(players[2], players[3])], [mk(null, null)]];
  if (n === 8) return [
    [mk(players[0], players[1]), mk(players[2], players[3]), mk(players[4], players[5]), mk(players[6], players[7])],
    [mk(null, null), mk(null, null)],
    [mk(null, null)]
  ];
  return [];
}

function advanceBracket(bracket, matchId, winnerId) {
  let ri = -1, mi = -1;
  bracket.forEach((r, r2) => r.forEach((m, m2) => { if (m.id === matchId) { ri = r2; mi = m2; } }));
  if (ri < 0) return bracket;
  const nb = bracket.map(r => r.map(m => ({ ...m })));
  nb[ri][mi].w = winnerId;
  if (ri + 1 < nb.length) nb[ri + 1][Math.floor(mi / 2)][mi % 2 === 0 ? "p1" : "p2"] = winnerId;
  return nb;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #04091e; --surf: #0a1230; --surf2: #0f1840; --surf3: #152060;
    --border: #1e2e6e; --border2: #2d42a0;
    --gold: #f5c518; --gold2: #c9a010;
    --text: #e8eaf6; --muted: #5a6ab0; --dim: #2a3580;
    --green: #16a34a; --red: #b91c1c; --orange: #c2410c;
    --board-head: #1230a0; --board-cell: #0c1d80;
    --radius: 10px; --radius-sm: 6px;
  }
  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; font-size: 14px; }
  input, select { background: var(--surf2); border: 1px solid var(--border); color: var(--text); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px; width: 100%; outline: none; transition: border .15s; font-family: inherit; }
  input:focus, select:focus { border-color: var(--gold); }
  select option { background: var(--surf2); }
  button { cursor: pointer; border: none; border-radius: var(--radius-sm); font-weight: 700; font-family: inherit; transition: filter .12s, transform .1s; }
  button:hover:not(:disabled) { filter: brightness(1.1); }
  button:active:not(:disabled) { transform: scale(.97); }
  button:disabled { opacity: .35; cursor: not-allowed; }

  .app { min-height: 100vh; display: flex; flex-direction: column; }
  .header { background: var(--surf); border-bottom: 1px solid var(--border); padding: 10px 20px; display: flex; align-items: center; gap: 10px; position: sticky; top: 0; z-index: 100; }
  .page { max-width: 920px; margin: 0 auto; padding: 20px 16px 48px; width: 100%; }
  .page-narrow { max-width: 560px; }
  .card { background: var(--surf); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; }
  .section-label { font-size: 10px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 10px; }
  .gold { color: var(--gold); }
  .muted { color: var(--muted); }
  .col { display: flex; flex-direction: column; }
  .row { display: flex; align-items: center; }
  .gap2 { gap: 8px; } .gap3 { gap: 12px; } .gap4 { gap: 16px; } .gap5 { gap: 20px; }
  .flex1 { flex: 1; }
  .wrap { flex-wrap: wrap; }
  .stack { display: flex; flex-direction: column; gap: 12px; }
  .tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; }
  .tag-gold { background: rgba(245,197,24,.12); color: var(--gold); border: 1px solid rgba(245,197,24,.2); }

  /* Buttons */
  .btn { padding: 8px 18px; font-size: 13px; }
  .btn-gold { background: var(--gold); color: #04091e; }
  .btn-ghost { background: var(--surf2); border: 1px solid var(--border); color: var(--text); }
  .btn-ghost:hover:not(:disabled) { border-color: var(--gold); filter: none; }
  .btn-green { background: var(--green); color: #fff; }
  .btn-red { background: var(--red); color: #fff; }
  .btn-orange { background: var(--orange); color: #fff; }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn-lg { padding: 11px 24px; font-size: 15px; border-radius: var(--radius); }
  .btn-block { width: 100%; padding: 12px; font-size: 14px; border-radius: var(--radius); }

  /* Jeopardy Board */
  .board-wrap { overflow-x: auto; padding-bottom: 4px; }
  .board { display: flex; gap: 4px; min-width: max-content; }
  .board-col { display: flex; flex-direction: column; gap: 4px; width: 130px; }
  .board-head {
    background: var(--board-head); border: 1.5px solid #2040c8;
    border-radius: var(--radius-sm); padding: 10px 8px; text-align: center;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 13px;
    text-transform: uppercase; letter-spacing: .5px; color: #fff;
    min-height: 58px; display: flex; align-items: center; justify-content: center; line-height: 1.2;
  }
  .board-cell {
    background: var(--board-cell); border: 1.5px solid #1a35b0; border-radius: var(--radius-sm);
    text-align: center; padding: 14px 4px; cursor: pointer;
    font-family: 'Barlow Condensed', sans-serif; font-weight: 900; font-size: 26px;
    color: var(--gold); min-height: 64px; display: flex; align-items: center; justify-content: center;
    transition: border-color .15s, background .15s, transform .1s;
    user-select: none;
  }
  .board-cell.avail:hover { border-color: var(--gold); background: #1428a0; transform: scale(1.04); }
  .board-cell.used { background: #07111f; border-color: #07111f; color: transparent; cursor: default; }
  .board-cell.locked { opacity: .3; cursor: default; transform: none !important; }

  /* Score pills */
  .score-pill { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; transition: outline .15s; }
  .score-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .score-name { font-size: 11px; font-weight: 700; }
  .score-val { font-size: 16px; font-weight: 900; color: #fff; }

  /* Phase bar */
  .phase-bar { padding: 5px 20px; text-align: center; font-size: 12px; font-weight: 700; border-bottom: 1px solid var(--border); }

  /* Right panel */
  .ctrl-panel { width: 270px; flex-shrink: 0; background: var(--surf); border-left: 1px solid var(--border); display: flex; flex-direction: column; padding: 16px; gap: 12px; overflow-y: auto; }
  .q-display { background: var(--board-head); border: 1px solid #2040c8; border-radius: var(--radius); padding: 14px; }
  .q-meta { font-size: 10px; font-weight: 700; color: #8898dd; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
  .q-text { color: #fff; font-weight: 700; font-size: 15px; line-height: 1.45; }
  .ctrl-btn { border-radius: var(--radius); padding: 13px; font-size: 14px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .steal-box { background: rgba(194,65,12,.12); border: 1px solid rgba(249,115,22,.3); border-radius: var(--radius); padding: 12px; text-align: center; }
  .steal-title { color: #fb923c; font-weight: 700; font-size: 13px; margin-bottom: 4px; }
  .steal-info { color: #fed7aa; font-size: 12px; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 2px 0; }

  /* Bracket */
  .bracket-wrap { overflow-x: auto; padding-bottom: 8px; }
  .bracket { display: flex; gap: 18px; align-items: flex-start; min-width: max-content; }
  .bracket-col { display: flex; flex-direction: column; gap: 10px; width: 190px; }
  .bracket-round { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; text-align: center; padding-bottom: 2px; }
  .match-card { background: var(--surf2); border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color .2s; }
  .match-card.active { border-color: var(--gold); }
  .match-card.done { border-color: #14532d; }
  .match-row { display: flex; align-items: center; gap: 8px; padding: 9px 12px; font-size: 13px; font-weight: 600; }
  .match-row + .match-row { border-top: 1px solid var(--border); }
  .match-row.win { background: rgba(22,163,74,.1); color: #86efac; }
  .match-row.loss { opacity: .4; }
  .match-score { margin-left: auto; font-size: 15px; font-weight: 900; color: var(--gold); }
  .match-btn { width: 100%; padding: 8px; font-size: 12px; border-top: 1px solid var(--border); border-radius: 0; }
  .champ-card { background: var(--surf2); border: 2px solid var(--gold); border-radius: var(--radius); padding: 20px; text-align: center; }

  /* Point selector */
  .pts-row { display: flex; gap: 4px; flex-shrink: 0; }
  .pts-chip { padding: 4px 7px; border-radius: 5px; font-size: 11px; font-weight: 700; background: var(--surf3); border: 1px solid var(--border); color: var(--muted); cursor: pointer; transition: all .12s; }
  .pts-chip.on { background: var(--gold); color: #04091e; border-color: var(--gold); }
  .pts-chip:hover:not(.on) { border-color: var(--gold); color: var(--gold); filter: none; }

  /* Misc */
  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
  .fade { animation: fadeIn .18s ease both; }
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .empty-state { text-align: center; padding: 60px 20px; color: var(--muted); }
  .show-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .show-row:hover { border-color: rgba(245,197,24,.4); }
  .player-dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--border); flex-shrink: 0; }
  .count-btn { flex: 1; padding: 12px; border-radius: var(--radius); font-size: 22px; font-weight: 900; background: var(--surf2); border: 2px solid var(--border); color: var(--muted); transition: all .15s; }
  .count-btn.on { background: rgba(245,197,24,.1); border-color: var(--gold); color: var(--gold); }
  .mode-btn { flex: 1; padding: 8px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 700; background: var(--surf2); border: 1.5px solid var(--border); color: var(--text); transition: all .15s; }
  .mode-btn.on { background: rgba(245,197,24,.1); border-color: var(--gold); color: var(--gold); }
  .topic-tab { padding: 5px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 700; background: var(--surf2); border: 1.5px solid var(--border); color: var(--text); transition: all .15s; cursor: pointer; }
  .topic-tab.on { background: rgba(245,197,24,.1); border-color: var(--gold); color: var(--gold); }
  .q-editor { background: var(--surf2); border-radius: var(--radius); padding: 14px; }
  .q-row { display: flex; align-items: center; gap: 8px; }
  .q-num { color: var(--muted); font-size: 12px; min-width: 18px; text-align: right; }
  .game-body { flex: 1; display: flex; overflow: hidden; min-height: 0; }
  .board-area { flex: 1; padding: 12px; overflow: auto; }
  .wait-panel { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
  .mini-game-btn { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: var(--radius); border: 1.5px solid var(--border); background: var(--surf2); font-size: 13px; font-weight: 700; transition: all .15s; cursor: pointer; }
  .mini-game-btn.on { border-color: var(--gold); background: rgba(245,197,24,.08); color: var(--gold); }
  .mini-game-btn.disabled { opacity: .35; cursor: not-allowed; }
  .board-cell.assoc-cell { background: #1a0850; border-color: #5020a0; }
  .board-cell.assoc-cell.avail:hover { border-color: #a060ff; background: #2a1070; }

  /* Associations panel */
  .assoc-display { background: #1a0640; border: 1px solid #5020a0; border-radius: var(--radius); padding: 14px; }
  .assoc-meta { font-size: 10px; font-weight: 700; color: #9060d0; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
  .assoc-answer { background: rgba(192,144,255,.1); border: 1.5px solid rgba(192,144,255,.3); color: #c090ff; border-radius: 8px; padding: 7px 14px; font-weight: 900; font-size: 18px; font-family: 'Barlow Condensed',sans-serif; text-align: center; margin-bottom: 12px; }
  .assoc-branch { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 5px; }
  .assoc-word { padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; transition: all .3s; }
  .assoc-word.revealed { background: rgba(192,144,255,.18); border: 1px solid rgba(192,144,255,.35); color: #c090ff; }
  .assoc-word.hidden { background: var(--surf3); border: 1px solid var(--border); color: var(--dim); }
  .assoc-arrow { color: var(--dim); font-size: 11px; flex-shrink: 0; }

  .hr { border: none; border-top: 1px solid var(--border); }
`;

// ─── Shared components ────────────────────────────────────────────────────────
function Btn({ children, variant = "gold", size = "md", block = false, className = "", ...rest }) {
  const v = { gold: "btn-gold", ghost: "btn-ghost", green: "btn-green", red: "btn-red", orange: "btn-orange" }[variant] || "btn-gold";
  const s = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const b = block ? "btn-block" : "btn";
  return <button className={`${b} ${v} ${s} ${className}`} {...rest}>{children}</button>;
}

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>;
}

function Card({ children, className = "", style = {} }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("login");
  const [shows, setShows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [games, setGames] = useState({});      // { [showId]: gameState }
  const [viewingId, setViewingId] = useState(null); // which show's game we're viewing

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    sGet("jshows").then(d => { if (d) setShows(d); });
    // Support both old single-game and new multi-game storage
    sGet("jgames").then(d => {
      if (d) { setGames(d); return; }
      // Migrate old single jgame
      sGet("jgame").then(old => { if (old) setGames({ [old.showId]: old }); });
    });
  }, []);

  const saveShows = async s => { setShows(s); await sSet("jshows", s); };

  const updateGame = async (showId, g) => {
    const updated = g
      ? { ...games, [showId]: g }
      : Object.fromEntries(Object.entries(games).filter(([k]) => k !== showId));
    setGames(updated);
    await sSet("jgames", updated);
  };

  if (view === "login") return <Login onLogin={() => setView("dash")} />;

  if (view === "dash") return (
    <Dashboard shows={shows} games={games}
      onNew={() => { setEditing(freshShow()); setView("edit"); }}
      onEdit={s => { setEditing(normaliseShow(s)); setView("edit"); }}
      onDelete={async id => {
        // Direct manipulation — no closures that could be stale
        const newShows = shows.filter(s => s.id !== id);
        setShows(newShows);
        sSet("jshows", newShows);
        // Remove game for this show
        const newGames = Object.fromEntries(Object.entries(games).filter(([k]) => k !== id));
        setGames(newGames);
        sSet("jgames", newGames);
      }}
      onPlay={s => { setEditing(s); setView("psetup"); }}
      onResume={showId => { setViewingId(showId); setView("game"); }}
      onLogout={() => setView("login")}
    />
  );

  if (view === "edit") return (
    <ShowEditor show={editing} onChange={setEditing}
      onSave={async () => {
        const upd = { ...editing, updatedAt: Date.now() };
        const next = shows.find(s => s.id === upd.id) ? shows.map(s => s.id === upd.id ? upd : s) : [...shows, upd];
        await saveShows(next); setView("dash");
      }}
      onCancel={() => setView("dash")}
    />
  );

  if (view === "psetup") return (
    <PlaySetup show={editing}
      onStart={async (players, bracket) => {
        const g = {
          showId: editing.id, showName: editing.name,
          rounds: (editing.rounds || []).map(r => ({ ...r, trivia: syncTopics(r.trivia || freshRound().trivia), associations: r.associations || { puzzles: [] }, buildacard: r.buildacard || { rounds: [] }, connections: r.connections || { rounds: [] } })),
          players, bracket, matches: {}, activeMatchId: null, subView: "bracket"
        };
        await updateGame(editing.id, g);
        setViewingId(editing.id);
        setView("game");
      }}
      onCancel={() => setView("dash")}
    />
  );

  if (view === "game" && viewingId && games[viewingId]) return (
    <GameView
      game={games[viewingId]}
      onUpdate={g => updateGame(viewingId, g)}
      onBack={() => setView("dash")}
    />
  );

  return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--muted)" }}>Loading…</div>;
}

// ─── Login ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const go = () => { if (pw === PASSWORD) onLogin(); else { setErr("Incorrect password."); setPw(""); } };
  return (
    <div className="login-wrap">
      <div style={{ width: "100%", maxWidth: 300 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 32, color: "var(--gold)", letterSpacing: 3 }}>JEOPARDY</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Host Access</div>
        </div>
        <Card className="stack">
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && go()} placeholder="Password" autoFocus style={{ textAlign: "center", letterSpacing: 2, fontSize: 15 }} />
          {err && <div style={{ color: "#f87171", fontSize: 12, textAlign: "center" }}>{err}</div>}
          <Btn block size="lg" onClick={go}>Enter →</Btn>
        </Card>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ shows, games, onNew, onEdit, onDelete, onPlay, onResume, onLogout }) {
  return (
    <div className="app">
      <div className="header">
        <div className="flex1">
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 18, color: "var(--gold)" }}>JEOPARDY HOST</div>
          <div className="muted" style={{ fontSize: 11 }}>Show Manager</div>
        </div>
        <Btn size="sm" onClick={onNew}>+ New Show</Btn>
        <Btn variant="ghost" size="sm" onClick={onLogout}>Logout</Btn>
      </div>
      <div className="page">
        {shows.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 52, marginBottom: 12 }}>📺</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No shows yet</div>
            <div style={{ fontSize: 13, marginBottom: 24 }}>Create your first Jeopardy show to get started.</div>
            <Btn onClick={onNew}>+ Create Show</Btn>
          </div>
        ) : (
          <div className="stack">
            {shows.map(s => {
              const filledTopics = (s.trivia?.topics || []).filter(t => t.name).length;
              const totalQ = (s.trivia?.topics || []).reduce((a, t) => a + t.questions.filter(q => q.text).length, 0);
              const assocRounds = (s.associations?.puzzles || []).filter(p => p.answer).length;
              const hasGame = !!games[s.id];
              return (
                <div key={s.id} className="card show-row fade" style={{ borderColor: hasGame ? "rgba(245,197,24,.4)" : "" }}>
                  <div className="flex1" style={{ minWidth: 0 }}>
                    <div className="row gap2" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--gold)" }}>{s.name}</span>
                      {hasGame && <span className="tag tag-gold">● Active</span>}
                    </div>
                    <div className="row gap3 muted" style={{ fontSize: 11, flexWrap: "wrap" }}>
                      {(s.miniGames || []).includes("trivia") && <span>📚 {filledTopics}/{s.trivia?.topicCount || 0} topics · ❓ {totalQ} q</span>}
                      {(s.miniGames || []).includes("associations") && <span>🔗 {assocRounds} rounds</span>}
                      <span>🕐 {new Date(s.updatedAt).toLocaleDateString()}</span>
                      {(s.miniGames || []).map(g => <span key={g} className="tag tag-gold">{g}</span>)}
                    </div>
                  </div>
                  <div className="row gap2">
                    <Btn variant="ghost" size="sm" onClick={() => onEdit(s)}>✏️ Edit</Btn>
                    <Btn variant="ghost" size="sm" style={{ color: "#f87171" }}
                      onClick={() => onDelete(s.id)}>🗑</Btn>
                    {hasGame && (
                      <Btn variant="green" size="sm" onClick={() => onResume(s.id)}>→ Resume</Btn>
                    )}
                    <Btn size="sm" onClick={() => onPlay(s)}>▶ New Game</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Show Editor ──────────────────────────────────────────────────────────────
function ShowEditor({ show, onChange, onSave, onCancel }) {
  const [activeRound, setActiveRound] = useState(0);

  const AVAILABLE_GAMES = [
    { id: "trivia",       label: "Trivia",          icon: "❓", ok: true  },
    { id: "buildacard",   label: "Build-a-Card",    icon: "🃏", ok: true  },
    { id: "associations", label: "Associations",     icon: "🔗", ok: true  },
    { id: "connections",  label: "Connections",      icon: "🔀", ok: true  },
  ];

  const rounds = show.rounds || [];
  const ai = Math.min(activeRound, Math.max(0, rounds.length - 1));
  const cur = rounds[ai];

  const setPlayerCount = n => {
    const names = ROUND_NAMES[n] || ["Round 1"];
    const newRounds = names.map((name, i) => ({
      id: rounds[i]?.id || uid(),
      name,
      miniGames: rounds[i]?.miniGames || ["trivia"],
      trivia: rounds[i]?.trivia || freshRound().trivia,
      associations: rounds[i]?.associations || freshRound().associations,
    }));
    onChange({ ...show, playerCount: n, rounds: newRounds });
    setActiveRound(0);
  };

  const updRound = (i, patch) => onChange({ ...show, rounds: rounds.map((r, ri) => ri === i ? { ...r, ...patch } : r) });

  const toggleRoundGame = (i, gameId) => {
    const mg = (rounds[i].miniGames || []).includes(gameId)
      ? rounds[i].miniGames.filter(g => g !== gameId)
      : [...(rounds[i].miniGames || []), gameId];
    updRound(i, { miniGames: mg });
  };

  return (
    <div className="app">
      <div className="header">
        <Btn variant="ghost" size="sm" onClick={onCancel}>← Back</Btn>
        <div style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 18, color: "var(--gold)" }}>
          {show.createdAt === show.updatedAt ? "✨ NEW SHOW" : "✏️ EDIT SHOW"}
        </div>
        <Btn onClick={onSave}>💾 Save Show</Btn>
      </div>
      <div className="page stack">

        {/* 1. Show name */}
        <Card>
          <SectionLabel>Show Name</SectionLabel>
          <input type="text" value={show.name} onChange={e => onChange({ ...show, name: e.target.value })}
            placeholder="Enter show name…" style={{ fontWeight: 700, fontSize: 16 }} />
        </Card>

        {/* 2. Player count — determines bracket structure & rounds */}
        <Card>
          <SectionLabel>Players — determines bracket & number of rounds</SectionLabel>
          <div className="row gap2">
            {[2, 4].map(n => (
              <button key={n} onClick={() => setPlayerCount(n)}
                className={`count-btn${show.playerCount === n ? " on" : ""}`}>
                {n}
              </button>
            ))}
          </div>
          {show.playerCount && (
            <div className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              {show.playerCount} players → {(ROUND_NAMES[show.playerCount] || []).length} bracket round(s):&nbsp;
              <strong style={{ color: "var(--text)" }}>{(ROUND_NAMES[show.playerCount] || []).join(" → ")}</strong>
            </div>
          )}
        </Card>

        {/* 3. Round tabs + per-round mini-games & questions */}
        {rounds.length > 0 ? (<>
          <div className="row gap2 wrap">
            {rounds.map((r, i) => (
              <button key={r.id} onClick={() => setActiveRound(i)}
                className={`topic-tab${i === ai ? " on" : ""}`}>
                {r.name || `Round ${i + 1}`}
              </button>
            ))}
          </div>

          {cur && (<>
            {/* Per-round mini-games */}
            <Card>
              <SectionLabel>{cur.name} — Mini-Games</SectionLabel>
              <div className="row gap2 wrap">
                {AVAILABLE_GAMES.map(g => (
                  <button key={g.id} onClick={() => g.ok && toggleRoundGame(ai, g.id)}
                    className={`mini-game-btn${(cur.miniGames||[]).includes(g.id)?" on":""}${!g.ok?" disabled":""}`}>
                    {g.icon} {g.label}
                    {!g.ok && <span style={{ fontSize: 10, color: "var(--dim)" }}>soon</span>}
                    {g.ok && (cur.miniGames||[]).includes(g.id) && <span style={{ color: "#4ade80" }}>✓</span>}
                  </button>
                ))}
              </div>
            </Card>

            {(cur.miniGames || []).includes("trivia") && (
              <TriviaEditor
                trivia={cur.trivia || freshRound().trivia}
                onChange={t => updRound(ai, { trivia: t })}
              />
            )}
            {(cur.miniGames || []).includes("buildacard") && (
              <BuildACardEditor
                bac={cur.buildacard || { rounds: [] }}
                onChange={b => updRound(ai, { buildacard: b })}
              />
            )}
            {(cur.miniGames || []).includes("associations") && (
              <AssociationsEditor
                assoc={cur.associations || { puzzles: [] }}
                onChange={a => updRound(ai, { associations: a })}
              />
            )}
            {(cur.miniGames || []).includes("connections") && (
              <ConnectionsEditor
                conn={cur.connections || { rounds: [] }}
                onChange={c => updRound(ai, { connections: c })}
              />
            )}
          </>)}
        </>) : (
          <div className="muted" style={{ textAlign: "center", padding: 32, fontSize: 13 }}>
            Select number of players above to set up rounds.
          </div>
        )}

      </div>
    </div>
  );
}


// ─── Trivia Editor ────────────────────────────────────────────────────────────
function TriviaEditor({ trivia, onChange }) {
  const [activeT, setActiveT] = useState(0);

  // Only re-sync structure when counts change, not on every keystroke
  const update = p => onChange(syncTopics({ ...trivia, ...p }));

  // Work directly on trivia.topics (already synced by parent) for text edits
  const topics = trivia.topics || [];
  const ti = Math.min(activeT, Math.max(0, topics.length - 1));
  const cur = topics[ti];
  const filled = cur?.questions.filter(q => q.text).length || 0;

  const setName = (idx, name) => onChange({ ...trivia, topics: topics.map((t, i) => i === idx ? { ...t, name } : t) });
  const setQ = (tidx, qidx, p) => onChange({
    ...trivia,
    topics: topics.map((t, ti2) => ti2 !== tidx ? t : { ...t, questions: t.questions.map((q, qi) => qi !== qidx ? q : { ...q, ...p }) })
  });

  return (
    <Card>
      <SectionLabel>Trivia Configuration</SectionLabel>
      <div className="row gap4 wrap" style={{ marginBottom: 16 }}>
        <div className="col" style={{ gap: 4, minWidth: 150 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Topics</label>
          <select value={trivia.topicCount} onChange={e => update({ topicCount: +e.target.value })}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} topic{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        <div className="col" style={{ gap: 4, minWidth: 170 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Questions per Topic</label>
          <select value={trivia.questionsPerTopic} onChange={e => update({ questionsPerTopic: +e.target.value })}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="col" style={{ gap: 4, minWidth: 170 }}>
          <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Seconds per Question</label>
          <select value={trivia.questionTime || 25} onChange={e => update({ questionTime: +e.target.value })}>
            {[20,21,22,23,24,25,26,27,28,29,30].map(n => <option key={n} value={n}>{n}s</option>)}
          </select>
        </div>
      </div>

      <div className="row gap2 wrap" style={{ marginBottom: 14 }}>
        {topics.map((t, i) => (
          <button key={t.id} onClick={() => setActiveT(i)} className={`topic-tab${i === ti ? " on" : ""}`}>
            {t.name || `Topic ${i + 1}`}
          </button>
        ))}
      </div>

      {cur && (
        <div className="q-editor fade">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>
              Category Name
            </label>
            <input type="text" value={cur.name} onChange={e => setName(ti, e.target.value)} placeholder="Category name..." style={{ fontWeight: 700 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{filled}/{trivia.questionsPerTopic} questions filled</div>
          <div className="stack" style={{ gap: 10 }}>
            {cur.questions.map((q, qi) => (
              <div key={q.id} style={{ background: "var(--surf3)", borderRadius: 8, padding: 10 }}>
                <div className="q-row" style={{ marginBottom: 8 }}>
                  <span className="q-num">{qi + 1}.</span>
                  <input type="text" value={q.text} onChange={e => setQ(ti, qi, { text: e.target.value })}
                    placeholder={`Question ${qi + 1}...`} style={{ flex: 1 }} />
                  <div className="pts-row">
                    {PTS.map(p => (
                      <button key={p} onClick={() => setQ(ti, qi, { points: p })}
                        className={`pts-chip${q.points === p ? " on" : ""}`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div className="row gap2" style={{ paddingLeft: 22 }}>
                  <input type="text" value={q.answer || ""} onChange={e => setQ(ti, qi, { answer: e.target.value })}
                    placeholder="Answer..." style={{ fontSize: 12 }} />
                </div>
                <div className="row gap2" style={{ paddingLeft: 22, marginTop: 6 }}>
                  <input type="text" value={q.imageUrl || ""} onChange={e => setQ(ti, qi, { imageUrl: e.target.value })}
                    placeholder="Image URL (optional)..." style={{ fontSize: 11, color: "var(--muted)" }} />
                  {q.imageUrl && (
                    <a href={q.imageUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap", textDecoration: "none", flexShrink: 0 }}>
                      Preview ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Associations Editor ──────────────────────────────────────────────────────
function AssociationsEditor({ assoc, onChange }) {
  const [ai, setAi] = useState(0);
  const puzzles = assoc.puzzles || [];

  const CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Left", "Bottom-Right"];

  const freshPuzzle = () => ({
    id: uid(), answer: "", points: 500, wordsPerBranch: 5,
    branches: [
      { id: uid(), words: Array(5).fill("") },
      { id: uid(), words: Array(5).fill("") },
      { id: uid(), words: Array(5).fill("") },
      { id: uid(), words: Array(5).fill("") },
    ]
  });

  const addPuzzle = () => { onChange({ ...assoc, puzzles: [...puzzles, freshPuzzle()] }); setAi(puzzles.length); };
  const removePuzzle = id => { onChange({ ...assoc, puzzles: puzzles.filter(p => p.id !== id) }); setAi(0); };

  const updPuzzle = (pid, patch) => onChange({ ...assoc, puzzles: puzzles.map(p => p.id !== pid ? p : { ...p, ...patch }) });

  // When wordsPerBranch changes, resize all branches
  const setWordsPerBranch = (pid, n) => {
    const p = puzzles.find(x => x.id === pid);
    const branches = p.branches.map(b => {
      const words = [...b.words];
      while (words.length < n) words.push("");
      return { ...b, words: words.slice(0, n) };
    });
    updPuzzle(pid, { wordsPerBranch: n, branches });
  };

  const setWord = (pid, bi, wi, val) => {
    const p = puzzles.find(x => x.id === pid);
    updPuzzle(pid, { branches: p.branches.map((b, i) => i !== bi ? b : { ...b, words: b.words.map((w, j) => j === wi ? val : w) }) });
  };

  const idx = Math.min(ai, Math.max(0, puzzles.length - 1));
  const cur = puzzles[idx];

  return (
    <Card>
      <div className="row gap2" style={{ marginBottom: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <SectionLabel style={{ margin: 0 }}>Associations — Rounds</SectionLabel>
          <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Each round is one puzzle. Admin reveals word cells one by one during play.</div>
        </div>
        <Btn size="sm" onClick={addPuzzle}>+ Add Round</Btn>
      </div>

      {puzzles.length === 0 && (
        <div className="muted" style={{ textAlign: "center", padding: "20px 0", fontSize: 13 }}>
          No rounds yet — click "Add Round" to create the first puzzle.
        </div>
      )}

      {puzzles.length > 0 && <>
        {/* Round tabs */}
        <div className="row gap2 wrap" style={{ marginBottom: 14 }}>
          {puzzles.map((p, i) => (
            <button key={p.id} onClick={() => setAi(i)} className={`topic-tab${i === idx ? " on" : ""}`}>
              Round {i + 1}{p.answer ? `: ${p.answer}` : ""}
            </button>
          ))}
        </div>

        {cur && (
          <div className="q-editor fade">
            {/* Answer + Words per corner */}
            <div className="row gap3 wrap" style={{ marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Answer (hidden from players)</label>
                <input type="text" value={cur.answer} onChange={e => updPuzzle(cur.id, { answer: e.target.value })}
                  placeholder="Answer..." style={{ fontWeight: 700 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Words per corner</label>
                <select value={cur.wordsPerBranch || 5} onChange={e => setWordsPerBranch(cur.id, +e.target.value)}
                  style={{ width: "auto" }}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* 4 corners in a 2x2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {cur.branches.map((branch, bi) => (
                <div key={branch.id} style={{ background: "var(--surf3)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#9060d0", fontWeight: 700, marginBottom: 8 }}>
                    {CORNER_LABELS[bi]} corner
                    <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>(outer → inner)</span>
                  </div>
                  <div className="stack" style={{ gap: 5 }}>
                    {branch.words.map((w, wi) => (
                      <div key={wi} className="row gap2">
                        <span className="muted" style={{ fontSize: 10, minWidth: 14 }}>{wi + 1}.</span>
                        <input type="text" value={w}
                          onChange={e => setWord(cur.id, bi, wi, e.target.value)}
                          placeholder={wi === branch.words.length - 1 ? "closest to answer" : `word ${wi + 1}`}
                          style={{ fontSize: 12, padding: "4px 8px" }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="row" style={{ marginTop: 12, justifyContent: "space-between", alignItems: "center" }}>
              <div className="muted" style={{ fontSize: 11 }}>Round {idx + 1} of {puzzles.length}</div>
              <Btn variant="ghost" size="sm" style={{ color: "#f87171" }}
                onClick={() => removePuzzle(cur.id)}>
                🗑 Delete Round
              </Btn>
            </div>
          </div>
        )}
      </>}
    </Card>
  );
}

// ─── Build a Card Editor ───────────────────────────────────────────────────────
function BuildACardEditor({ bac, onChange }) {
  const [ai, setAi] = useState(0);
  const rounds = bac.rounds || [];

  const freshBacRound = () => ({ id: uid(), numbers: [], keywords: [], points: 500, _numInput: "", _kwInput: "" });
  const addRound = () => { onChange({ ...bac, rounds: [...rounds, freshBacRound()] }); setAi(rounds.length); };
  const removeRound = id => { onChange({ ...bac, rounds: rounds.filter(r => r.id !== id) }); setAi(0); };
  const updRound = (id, patch) => onChange({ ...bac, rounds: rounds.map(r => r.id !== id ? r : { ...r, ...patch }) });

  const idx = Math.min(ai, Math.max(0, rounds.length - 1));
  const cur = rounds[idx];

  const addNumber = (id, val) => {
    const n = val.trim(); if (!n) return;
    const r = rounds.find(x => x.id === id);
    updRound(id, { numbers: [...r.numbers, n], _numInput: "" });
  };
  const removeNumber = (id, i) => {
    const r = rounds.find(x => x.id === id);
    updRound(id, { numbers: r.numbers.filter((_, j) => j !== i) });
  };
  const addKeyword = (id, val) => {
    const k = val.trim(); if (!k) return;
    const r = rounds.find(x => x.id === id);
    updRound(id, { keywords: [...r.keywords, k], _kwInput: "" });
  };
  const removeKeyword = (id, i) => {
    const r = rounds.find(x => x.id === id);
    updRound(id, { keywords: r.keywords.filter((_, j) => j !== i) });
  };

  return (
    <Card>
      <div className="row gap2" style={{ marginBottom: 14 }}>
        <SectionLabel style={{ margin: 0, flex: 1 }}>Build-a-Card — Rounds</SectionLabel>
        <Btn size="sm" onClick={addRound}>+ Add Round</Btn>
      </div>
      {rounds.length === 0 && <div className="muted" style={{ textAlign: "center", padding: "20px 0", fontSize: 13 }}>No rounds yet — click "Add Round".</div>}
      {rounds.length > 0 && <>
        <div className="row gap2 wrap" style={{ marginBottom: 14 }}>
          {rounds.map((r, i) => (
            <button key={r.id} onClick={() => setAi(i)} className={`topic-tab${i === idx ? " on" : ""}`}>
              Round {i + 1}
            </button>
          ))}
        </div>
        {cur && (
          <div className="q-editor fade">
            {/* Image URL */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, display: "block", marginBottom: 5 }}>Card Image URL (optional)</label>
              <div className="row gap2">
                <input type="text" value={cur.imageUrl || ""} onChange={e => updRound(cur.id, { imageUrl: e.target.value })}
                  placeholder="Image URL..." />
                {cur.imageUrl && (
                  <a href={cur.imageUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--gold)", whiteSpace: "nowrap", textDecoration: "none", flexShrink: 0 }}>
                    Preview ↗
                  </a>
                )}
              </div>
            </div>
            {/* Numbers pool */}
            <div style={{ marginBottom: 14 }}>
              <div className="section-label">Numbers pool</div>
              <div className="row gap2 wrap" style={{ marginBottom: 8 }}>
                {(cur.numbers || []).map((n, i) => (
                  <span key={i} style={{ background: "var(--surf3)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {n}
                    <button onClick={() => removeNumber(cur.id, i)} style={{ background: "none", color: "var(--muted)", fontSize: 12, padding: 0, cursor: "pointer" }}>✕</button>
                  </span>
                ))}
              </div>
              <div className="row gap2">
                <input type="text" value={cur._numInput || ""} onChange={e => updRound(cur.id, { _numInput: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && addNumber(cur.id, cur._numInput || "")}
                  placeholder="Add number..." style={{ width: 140 }} />
                <Btn size="sm" variant="ghost" onClick={() => addNumber(cur.id, cur._numInput || "")}>+ Add</Btn>
              </div>
            </div>

            {/* Keywords pool */}
            <div>
              <div className="section-label">Keywords pool</div>
              <div className="row gap2 wrap" style={{ marginBottom: 8 }}>
                {(cur.keywords || []).map((k, i) => (
                  <span key={i} style={{ background: "var(--surf3)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 10px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {k}
                    <button onClick={() => removeKeyword(cur.id, i)} style={{ background: "none", color: "var(--muted)", fontSize: 12, padding: 0, cursor: "pointer" }}>✕</button>
                  </span>
                ))}
              </div>
              <div className="row gap2">
                <input type="text" value={cur._kwInput || ""} onChange={e => updRound(cur.id, { _kwInput: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && addKeyword(cur.id, cur._kwInput || "")}
                  placeholder="Add keyword..." style={{ width: 160 }} />
                <Btn size="sm" variant="ghost" onClick={() => addKeyword(cur.id, cur._kwInput || "")}>+ Add</Btn>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
              <Btn variant="ghost" size="sm" style={{ color: "#f87171" }} onClick={() => removeRound(cur.id)}>🗑 Delete Round</Btn>
            </div>
          </div>
        )}
      </>}
    </Card>
  );
}

// ─── Play Setup ───────────────────────────────────────────────────────────────
function PlaySetup({ show, onStart, onCancel }) {
  const defaultCount = show.playerCount || 4;
  const [count, setCount] = useState(defaultCount);
  const [players, setPlayers] = useState(() => Array.from({ length: defaultCount }, (_, i) => ({ id: uid(), name: "", color: PLAYER_COLORS[i] })));
  const [mode, setMode] = useState("random");
  const [manualOrder, setManualOrder] = useState(null);

  const changeCount = n => {
    setCount(n);
    setPlayers(prev => {
      const next = [...prev];
      while (next.length < n) next.push({ id: uid(), name: "", color: PLAYER_COLORS[next.length % PLAYER_COLORS.length] });
      return next.slice(0, n);
    });
    setManualOrder(null);
  };

  const doStart = () => {
    if (players.some(p => !p.name.trim())) { alert("All players need names!"); return; }
    let ordered = [...players];
    if (mode === "random") {
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    } else if (manualOrder) ordered = manualOrder;
    onStart(ordered, buildBracket(ordered));
  };

  return (
    <div className="app">
      <div className="header">
        <Btn variant="ghost" size="sm" onClick={onCancel}>← Back</Btn>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 17, color: "var(--gold)" }}>{show.name}</div>
          <div className="muted" style={{ fontSize: 11 }}>Players & Bracket Setup</div>
        </div>
        <Btn onClick={doStart}>Start Game →</Btn>
      </div>
      <div className="page page-narrow stack">
        <Card>
          <SectionLabel>Number of Players</SectionLabel>
          <div className="row gap2">
            {[2, 4].map(n => (
              <button key={n} onClick={() => changeCount(n)} className={`count-btn${count === n ? " on" : ""}`}>{n}</button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel>Players</SectionLabel>
          <div className="stack" style={{ gap: 10 }}>
            {players.map((p, i) => (
              <div key={p.id} className="row gap3">
                <div className="player-dot" style={{ background: p.color }} />
                <span className="muted" style={{ fontSize: 11, minWidth: 50 }}>Player {i + 1}</span>
                <input type="text" value={p.name}
                  onChange={e => setPlayers(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder={`Player ${i + 1}…`} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionLabel>Bracket Mode</SectionLabel>
          <div className="row gap2" style={{ marginBottom: 14 }}>
            {["random", "manual"].map(m => (
              <button key={m} onClick={() => setMode(m)} className={`mode-btn${mode === m ? " on" : ""}`}>
                {m === "random" ? "🎲 Random" : "✏️ Manual"}
              </button>
            ))}
          </div>
          {mode === "random" && <div className="muted" style={{ fontSize: 12 }}>Players will be randomly seeded when you click Start.</div>}
          {mode === "manual" && <ManualBracket players={players} onChange={setManualOrder} />}
        </Card>
      </div>
    </div>
  );
}

function ManualBracket({ players, onChange }) {
  const mc = Math.floor(players.length / 2);
  const [slots, setSlots] = useState(() => players.map(p => p.id));
  useEffect(() => {
    const ord = slots.map(id => players.find(p => p.id === id)).filter(Boolean);
    onChange(ord);
  }, [slots]);
  const gp = id => players.find(p => p.id === id);
  const swapTo = (fi, toId) => {
    const ti2 = slots.indexOf(toId);
    const n = [...slots]; [n[fi], n[ti2]] = [n[ti2], n[fi]]; setSlots(n);
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {Array.from({ length: mc }, (_, mi) => (
        <div key={mi} style={{ background: "var(--surf3)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10 }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Match {mi + 1}</div>
          <div className="row gap2">
            <div className="flex1 row gap2" style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "5px 8px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: gp(slots[mi * 2])?.color, flexShrink: 0 }} />
              <select value={slots[mi * 2]} onChange={e => swapTo(mi * 2, e.target.value)} style={{ padding: "2px 4px", fontSize: 12 }}>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>vs</span>
            <div className="flex1 row gap2" style={{ background: "var(--surf)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "5px 8px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: gp(slots[mi * 2 + 1])?.color, flexShrink: 0 }} />
              <select value={slots[mi * 2 + 1]} onChange={e => swapTo(mi * 2 + 1, e.target.value)} style={{ padding: "2px 4px", fontSize: 12 }}>
                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Game View ────────────────────────────────────────────────────────────────
function GameView({ game, onUpdate, onBack }) {
  if (game.subView === "match" && game.activeMatchId && game.matches[game.activeMatchId])
    return <MatchScreen game={game} onUpdate={onUpdate} />;
  return <BracketScreen game={game} onUpdate={onUpdate} onBack={onBack} />;
}

function BracketScreen({ game, onUpdate, onBack }) {
  const { players, bracket, matches } = game;
  const gp = id => players.find(p => p.id === id);
  const rnames = bracket.length === 1 ? ["Final"] : bracket.length === 2 ? ["Semifinals", "Final"] : ["Quarterfinals", "Semifinals", "Final"];
  const champion = gp(bracket[bracket.length - 1]?.[0]?.w);

  const startMatch = async matchId => {
    const m = bracket.flat().find(x => x.id === matchId); if (!m) return;
    // Flat index: position of this match across all bracket rounds in order
    const allMatches = bracket.flat();
    const flatIdx = allMatches.findIndex(mm => mm.id === matchId);
    // Each match maps to its own round (Semifinal 1 → rounds[0], Semifinal 2 → rounds[1], Final → rounds[2])
    const rounds = game.rounds || [];
    const roundData = rounds[Math.min(flatIdx, rounds.length - 1)] || { miniGames: ["trivia"], trivia: { topicCount: 0, questionsPerTopic: 0, topics: [] }, associations: { puzzles: [] }, buildacard: { rounds: [] }, connections: { rounds: [] } };
    const md = { p1: m.p1, p2: m.p2, scores: { [m.p1]: 0, [m.p2]: 0 }, board: buildBoard(roundData.trivia, roundData.associations, roundData.buildacard, roundData.connections, roundData.miniGames || ["trivia"]), turn: m.p1, phase: "select_minigame", activeMinigame: null, completedMinigames: [], activeQ: null, roundMiniGames: roundData.miniGames || ["trivia"] };
    await onUpdate({ ...game, activeMatchId: matchId, subView: "match", matches: { ...matches, [matchId]: md } });
  };

  return (
    <div className="app">
      <div className="header">
        <Btn variant="ghost" size="sm" onClick={onBack}>← Shows</Btn>
        <div style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 17, color: "var(--gold)" }}>🏆 {game.showName}</div>
        {champion && <span className="tag tag-gold" style={{ fontSize: 13 }}>🏆 Champion: {champion.name}</span>}
        <Btn variant="ghost" size="sm" style={{ color: "#f87171" }} onClick={async () => { await onUpdate(null); onBack(); }}>End Game</Btn>
      </div>
      <div className="page">
        <div className="bracket-wrap">
          <div className="bracket">
            {bracket.map((round, ri) => (
              <div key={ri} className="bracket-col">
                <div className="bracket-round">{rnames[ri]}</div>
                {round.map(m => {
                  const md = matches[m.id];
                  const p1 = gp(m.p1), p2 = gp(m.p2);
                  const done = !!m.w, active = game.activeMatchId === m.id;
                  const ready = p1 && p2 && !done && !active;
                  return (
                    <div key={m.id} className={`match-card fade${active ? " active" : done ? " done" : ""}`}>
                      {[{ p: p1, pid: m.p1 }, { p: p2, pid: m.p2 }].map(({ p, pid }, k) => (
                        <div key={k} className={`match-row${m.w === pid ? " win" : done && m.w !== pid ? " loss" : ""}`}>
                          {p ? (<>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}{m.w === pid ? " ✓" : ""}</span>
                            {md && <span className="match-score">{md.scores?.[pid] ?? 0}</span>}
                          </>) : <span className="muted" style={{ fontStyle: "italic", fontSize: 12 }}>TBD</span>}
                        </div>
                      ))}
                      {ready && <button className="btn-gold match-btn" onClick={() => startMatch(m.id)}>▶ Start Match</button>}
                      {active && <button className="btn-orange match-btn" onClick={() => onUpdate({ ...game, subView: "match" })}>→ Resume</button>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="bracket-col">
              <div className="bracket-round">🏆 Champion</div>
              <div className="champ-card">
                {champion ? (<>
                  <div style={{ fontSize: 34, marginBottom: 8 }}>🏆</div>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 20, color: champion.color }}>{champion.name}</div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Tournament Winner</div>
                </>) : <div className="muted" style={{ fontStyle: "italic", fontSize: 13, padding: "14px 0" }}>TBD</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Match Screen ─────────────────────────────────────────────────────────────
function MatchScreen({ game, onUpdate }) {
  const md = game.matches[game.activeMatchId];
  if (!md) return null;
  const { p1, p2, scores, board, turn, phase, activeQ, activeMinigame, completedMinigames, roundMiniGames } = md;
  const gp = id => game.players.find(p => p.id === id);
  const turnP = gp(turn), otherP = gp(turn === p1 ? p2 : p1);
  const aq = activeQ ? board[activeQ.ti].qs[activeQ.qi] : null;

  // imageUrl: read from board, or fall back to original round trivia data by question id
  const aqImageUrl = (() => {
    if (!aq || aq.type === "assoc" || aq.type === "buildacard") return null;
    if (aq.imageUrl) return aq.imageUrl;
    // Fallback: search original round data by question id
    for (const r of (game.rounds || [])) {
      for (const t of (r.trivia?.topics || [])) {
        const q = t.questions?.find(q => q.id === aq.id);
        if (q?.imageUrl) return q.imageUrl;
      }
    }
    return null;
  })();
  // Find questionTime from the round that was used for this match
  const questionTime = (() => {
    const rounds = game.rounds || [];
    for (const r of rounds) {
      if (r.trivia?.questionTime) return r.trivia.questionTime;
    }
    return 25;
  })();

  const [timerLeft, setTimerLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [assocPoints, setAssocPoints] = useState(100);
  const [answerRevealed, setAnswerRevealed] = useState(false);

  // Reset timer and assocPoints whenever a new question is selected
  useEffect(() => {
    setTimerLeft(null); setTimerRunning(false);
    setAnswerRevealed(false);
    if (aq?.type === "assoc") setAssocPoints(100);
  }, [activeQ]);
  useEffect(() => { if (phase === "steal") { setTimerLeft(null); setTimerRunning(false); } }, [phase]);

  // Countdown tick
  useEffect(() => {
    if (!timerRunning || timerLeft === null || timerLeft <= 0) {
      if (timerLeft === 0) setTimerRunning(false);
      return;
    }
    const t = setTimeout(() => setTimerLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, timerLeft]);

  const startTimer = () => { setTimerLeft(questionTime); setTimerRunning(true); };

  // Switch active turn to any player — works at any time
  const switchTurn = async pid => {
    await upd({ turn: pid });
  };

  const upd = async patch => await onUpdate({ ...game, matches: { ...game.matches, [game.activeMatchId]: { ...md, ...patch } } });

  // For Associations: reveal individual word cell
  const revealCell = async (bi, wi) => {
    if (!aq || aq.type !== "assoc") return;
    const key = `${bi}-${wi}`;
    if ((aq.revealedCells || []).includes(key)) return;
    const newBoard = board.map((t, ti) => ({
      ...t, qs: t.qs.map((q, qi) =>
        ti === activeQ.ti && qi === activeQ.qi
          ? { ...q, revealedCells: [...(q.revealedCells || []), key] }
          : q
      )
    }));
    await upd({ board: newBoard });
  };

  // For Associations: reveal the center answer
  const revealCenter = async () => {
    if (!aq || aq.type !== "assoc" || aq.centerRevealed) return;
    const newBoard = board.map((t, ti) => ({
      ...t, qs: t.qs.map((q, qi) =>
        ti === activeQ.ti && qi === activeQ.qi
          ? { ...q, centerRevealed: true }
          : q
      )
    }));
    await upd({ board: newBoard });
  };

  // For Trivia only: reveal layer (kept for backward compat)
  const revealLayer = async () => {
    if (!aq || aq.type !== "assoc") return;
    const newRL = (aq.revealedLayers || 0) + 1;
    const ppL = Math.floor(aq.points / (aq.maxLayers + 1));
    const newPts = Math.max(ppL, aq.points - newRL * ppL);
    const newBoard = board.map((t, ti) => ({ ...t, qs: t.qs.map((q, qi) => ti === activeQ.ti && qi === activeQ.qi ? { ...q, revealedLayers: newRL, points: newPts } : q) }));
    await upd({ board: newBoard });
  };

  const markBoard = () => board.map((t, ti) => ({
    ...t, qs: t.qs.map((q, qi) => ti === activeQ.ti && qi === activeQ.qi ? { ...q, done: true } : q)
  }));

  const allDone = b => b.every(t => t.qs.every(q => q.done));

  const minigameDone = (mg, b) => {
    const colType = mg === "trivia" ? "trivia" : mg === "associations" ? "assoc" : mg === "buildacard" ? "buildacard" : "connections";
    return b.filter(c => c.type === colType).every(c => c.qs.every(q => q.done));
  };

  const finishMinigame = async (fs, fb) => {
    const newCompleted = [...(completedMinigames || []), activeMinigame];
    const remaining = (roundMiniGames || []).filter(mg => !newCompleted.includes(mg));
    if (remaining.length === 0) {
      // All minigames done — end match
      const s1 = fs[p1] || 0, s2 = fs[p2] || 0;
      const winner = s1 > s2 ? p1 : s2 > s1 ? p2 : p1;
      const nb = advanceBracket(game.bracket, game.activeMatchId, winner);
      await onUpdate({ ...game, bracket: nb, activeMatchId: null, subView: "bracket", matches: { ...game.matches, [game.activeMatchId]: { ...md, phase: "done", scores: fs, board: fb, winner } } });
    } else {
      // More minigames left — go back to selector
      await upd({ phase: "select_minigame", activeMinigame: null, activeQ: null, scores: fs, board: fb, completedMinigames: newCompleted });
    }
  };

  const endMatch = async (fs, fb) => finishMinigame(fs, fb);

  const correct = async () => {
    if (!aq) return;
    const pts = aq.type === "assoc" ? assocPoints : aq.type === "buildacard" ? (aq._pts || 0) : aq.points;
    const nb = markBoard(); const ns = { ...scores, [turn]: (scores[turn] || 0) + pts }; const nxt = turn === p1 ? p2 : p1;
    if (minigameDone(activeMinigame, nb)) await endMatch(ns, nb); else await upd({ phase: "picking", activeQ: null, board: nb, scores: ns, turn: nxt });
  };
  const wrong = async () => {
    // No steal for Build a Card
    if (aq?.type === "buildacard") {
      const nb = markBoard(); const nxt = turn === p1 ? p2 : p1;
      if (minigameDone(activeMinigame, nb)) await endMatch(scores, nb);
      else await upd({ phase: "picking", activeQ: null, board: nb, turn: nxt });
    } else {
      await upd({ phase: "steal_offer" });
    }
  };
  const cancelQ = async () => upd({ phase: "picking", activeQ: null });
  const skipSteal = async () => {
    const nb = markBoard(); const nxt = turn === p1 ? p2 : p1;
    if (minigameDone(activeMinigame, nb)) await endMatch(scores, nb); else await upd({ phase: "picking", activeQ: null, board: nb, turn: nxt });
  };
  const stealResult = async ok => {
    if (!aq) return;
    const pts = aq.type === "assoc" ? assocPoints : aq.type === "buildacard" ? (aq._pts || 0) : aq.points;
    const half = Math.floor(pts / 2); const sid = turn === p1 ? p2 : p1;
    const nb = markBoard(); const ns = { ...scores, [sid]: (scores[sid] || 0) + (ok ? half : -half) };
    if (minigameDone(activeMinigame, nb)) await endMatch(ns, nb); else await upd({ phase: "picking", activeQ: null, board: nb, scores: ns, turn: sid });
  };

  const phaseInfo = {
    select_minigame: { text: "Select a mini-game to play", col: "var(--gold)" },
    picking: { text: `${turnP?.name}'s turn to pick`, col: turnP?.color },
    answering: { text: `${turnP?.name} is answering…`, col: turnP?.color },
    steal_offer: { text: `Steal opportunity for ${otherP?.name}!`, col: otherP?.color },
    steal: { text: `${otherP?.name} is stealing!`, col: otherP?.color },
  }[phase] || { text: "", col: "var(--muted)" };

  const isTurn = pid => turn === pid && (phase === "picking" || phase === "answering");
  const isSteal = pid => (phase === "steal" || phase === "steal_offer") && pid !== turn;

  return (
    <div className="app">
      <div className="header" style={{ gap: 10 }}>
        <Btn variant="ghost" size="sm" onClick={() => onUpdate({ ...game, subView: "bracket" })}>← Bracket</Btn>
        <span style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 15, color: "var(--gold)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.showName}</span>
        <div className="row gap2">
          {[p1, p2].map(pid => {
            const p = gp(pid);
            const isActive = isTurn(pid) || isSteal(pid);
            const isOther = pid !== turn;
            return (
              <div key={pid} className="score-pill"
                onClick={() => isOther && switchTurn(pid)}
                style={{
                  background: `${p?.color}16`,
                  outline: isActive ? `1.5px solid ${p?.color}` : "1.5px solid transparent",
                  cursor: isOther ? "pointer" : "default",
                  transition: "outline .15s",
                }}>
                <div className="score-dot" style={{ background: p?.color }} />
                <span className="score-name" style={{ color: p?.color }}>{p?.name}</span>
                <span className="score-val">{scores[pid] ?? 0}</span>
                {isOther && <span style={{ fontSize: 9, color: p?.color, opacity: .6 }}>↑</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="phase-bar" style={{ background: `${phaseInfo.col}14`, color: phaseInfo.col }}>
        {phaseInfo.text}
      </div>

      <div className="game-body">
        {phase === "select_minigame" ? (
          /* ── Mini-game selector ── */
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:32 }}>
            <div style={{ fontSize:13, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>Choose next mini-game</div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
              {(roundMiniGames||[]).filter(mg=>!(completedMinigames||[]).includes(mg)).map(mg=>(
                <button key={mg} onClick={()=>upd({phase:"picking", activeMinigame:mg, activeQ:null})}
                  style={{ padding:"22px 40px", borderRadius:12, border:"2px solid var(--gold)", background:"rgba(245,197,24,.08)", color:"var(--gold)", fontWeight:900, fontSize:20, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase", transition:"background .15s" }}>
                  {mg === "trivia" ? "❓ Trivia" : mg === "associations" ? "🔗 Associations" : mg === "buildacard" ? "🃏 Build-a-Card" : "🔀 Connections"}
                </button>
              ))}
            </div>
            {(completedMinigames||[]).length > 0 && (
              <div style={{ fontSize:11, color:"var(--muted)" }}>Completed: {completedMinigames.join(", ")}</div>
            )}
          </div>
        ) : aq?.type === "assoc" ? (
          /* ── Associations tree view ── */
          <>
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <AssociationTreeView puzzle={aq} onRevealCell={phase === "answering" ? revealCell : null} onRevealCenter={phase === "answering" ? revealCenter : null} />
            </div>
            <div className="ctrl-panel">
              <AssociationsPanel
                aq={aq} turnP={turnP} otherP={otherP} phase={phase}
                assocPoints={assocPoints} onAssocPointsChange={setAssocPoints}
                onCorrect={correct} onWrong={wrong}
                onSteal={() => upd({ phase: "steal" })} onSkipSteal={skipSteal}
                onStealCorrect={() => stealResult(true)} onStealWrong={() => stealResult(false)}
                onCancel={cancelQ}
              />
            </div>
          </>
        ) : aq?.type === "buildacard" ? (
          /* ── Build a Card game ── */
          <BuildACardGame
            aq={aq} turnP={turnP} otherP={otherP} phase={phase}
            onAssign={async (slot, val) => {
              const newAssigned = { ...aq.assigned };
              if (slot === "keyword_add") {
                newAssigned.keywords = [...(newAssigned.keywords||[]), val];
              } else if (slot === "keyword_remove") {
                newAssigned.keywords = (newAssigned.keywords||[]).filter((_,i)=>i!==val);
              } else if (slot === "reset") {
                newAssigned.mana = null; newAssigned.attack = null; newAssigned.health = null; newAssigned.keywords = [];
              } else if (slot === "_pts") {
                const nb = board.map((t,ti)=>({...t, qs:t.qs.map((q,qi)=>ti===activeQ.ti&&qi===activeQ.qi?{...q,_pts:val}:q)}));
                await upd({ board: nb }); return;
              } else {
                newAssigned[slot] = val;
              }
              const nb = board.map((t,ti)=>({...t, qs:t.qs.map((q,qi)=>ti===activeQ.ti&&qi===activeQ.qi?{...q,assigned:newAssigned}:q)}));
              await upd({ board: nb });
            }}
            onAwardPoints={async pts => {
              const ns = { ...scores, [turn]: (scores[turn]||0) + pts };
              await upd({ scores: ns });
            }}
            onFinish={async () => {
              const nb = markBoard();
              if (minigameDone("buildacard", nb)) await endMatch(scores, nb);
              else await upd({ phase:"picking", activeQ:null, board:nb });
            }}
            onCancel={cancelQ}
          />
        ) : aq?.type === "connections" ? (
          /* ── Connections game ── */
          <ConnectionsGame
            aq={aq} turnP={turnP} phase={phase}
            onUpdateQ={async patch => {
              const nb = board.map((t,ti)=>({...t,qs:t.qs.map((q,qi)=>ti===activeQ.ti&&qi===activeQ.qi?{...q,...patch}:q)}));
              await upd({ board: nb });
            }}
            onAwardPoints={async pts => {
              const ns = {...scores, [turn]: (scores[turn]||0)+pts};
              await upd({ scores: ns });
            }}
            onFinish={async () => {
              const nb = board.map((t,ti)=>({...t,qs:t.qs.map((q,qi)=>ti===activeQ.ti&&qi===activeQ.qi?{...q,done:true}:q)}));
              if (minigameDone("connections", nb)) await endMatch(scores, nb);
              else await upd({ phase:"picking", activeQ:null, board:nb });
            }}
          />
        ) : (
          <>
            {/* Board area — darkens when question is active */}
            <div className="board-area" style={{ position: "relative" }}>
              <div className="board-wrap">
                <div className="board">
                  {board.filter(col => {
                    if (activeMinigame === "associations") return col.type === "assoc";
                    if (activeMinigame === "buildacard") return col.type === "buildacard";
                    if (activeMinigame === "connections") return col.type === "connections";
                    return col.type === "trivia";
                  }).map((topic, ti) => {
                    const realTi = board.indexOf(topic);
                    return (
                      <div key={realTi} className="board-col">
                        <div className="board-head" style={{
                          fontSize: 13, fontWeight: 900,
                          ...(topic.type === "assoc" ? { background: "#2a0870", borderColor: "#6030c0" } : topic.type === "buildacard" ? { background: "#0a2840", borderColor: "#1a6090" } : topic.type === "connections" ? { background: "#0a2818", borderColor: "#1a6040" } : {})
                        }}>
                          {topic.name || `Topic ${realTi + 1}`}
                        </div>
                        {topic.qs.map((q, qi) => {
                          const canClick = !q.done && phase === "picking";
                          const isAssoc = q.type === "assoc";
                          const isBac = q.type === "buildacard";
                          const isConn = q.type === "connections";
                          const label = isAssoc ? `Round ${qi + 1}` : isBac ? `#${qi + 1} Card` : isConn ? `Round ${qi + 1}` : q.points;
                          return (
                            <div key={q.id}
                              className={`board-cell${q.done ? " used" : canClick ? ` avail${isAssoc ? " assoc-cell" : ""}` : " locked"}`}
                              style={{ fontSize: (isAssoc || isBac || isConn) ? 14 : undefined, fontWeight: (isAssoc || isBac || isConn) ? 700 : undefined }}
                              onClick={() => canClick && upd({ phase: "answering", activeQ: { ti: realTi, qi } })}>
                              {!q.done && label}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overlay — appears when trivia question is active */}
              {aq && aq.type !== "assoc" && aq.type !== "buildacard" && aq.type !== "connections" && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(3,8,42,0.88)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 20, padding: 24,
                }}>
                  <div style={{
                    background: "#0a1545", border: "2px solid #2d42a0",
                    borderRadius: 14, padding: 28, maxWidth: 580, width: "100%",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                  }}>
                    {/* Category + points */}
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 12 }}>
                      {board[activeQ.ti].name} — <span style={{ color: "var(--gold)" }}>{aq.points} pts</span>
                    </div>

                    {/* Image */}
                    {aqImageUrl && (
                      <div style={{ marginBottom: 16, textAlign: "center" }}>
                        <img src={aqImageUrl} alt="question"
                          style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "contain", cursor: "pointer" }}
                          onClick={() => window.open(aqImageUrl, "_blank")}
                          onError={e => { e.target.style.display = "none"; }} />
                      </div>
                    )}

                    {/* Question */}
                    <div style={{
                      fontSize: "clamp(16px, 2.2vw, 24px)", fontWeight: 800,
                      color: "#fff", lineHeight: 1.4, marginBottom: 24,
                      textAlign: "center",
                    }}>
                      {aq.text || "(no question text)"}
                    </div>

                    {/* Answer field */}
                    <div
                      onClick={() => setAnswerRevealed(r => !r)}
                      style={{
                        background: answerRevealed ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
                        border: `2px solid ${answerRevealed ? "#4ade80" : "rgba(255,255,255,0.15)"}`,
                        borderRadius: 10, padding: "14px 20px",
                        textAlign: "center", cursor: "pointer",
                        transition: "all .25s",
                        minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                      {answerRevealed ? (
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>
                          {aq.answer || "(no answer set)"}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>
                          Click to reveal answer
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — timer + correct/wrong only */}
            <div className="ctrl-panel">
              {!aq ? (
                <div className="wait-panel">
                  <div style={{ fontSize: 42, opacity: .2 }}>👆</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: turnP?.color }}>{turnP?.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Select a question from the board</div>
                </div>
              ) : (
            <>
              {/* Cancel button */}
              <button onClick={cancelQ} style={{ background:"none", color:"var(--muted)", fontSize:12, padding:"2px 6px", border:"1px solid var(--border)", borderRadius:5, marginBottom:8, alignSelf:"flex-end" }}>✕ Cancel</button>
              <hr className="divider" />

              {phase === "answering" && (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="muted" style={{ fontSize: 11, textAlign: "center" }}>{turnP?.name} is answering…</div>

                  {/* Timer */}
                  {timerLeft === null ? (
                    <button className="btn-ghost btn-block" style={{ borderRadius: 8, padding: "9px", fontSize: 13 }} onClick={startTimer}>
                      ▶ Start Timer ({questionTime}s)
                    </button>
                  ) : (
                    <div style={{ textAlign: "center", background: "var(--surf2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 8px" }}>
                      <div style={{
                        fontSize: 46, fontWeight: 900, lineHeight: 1,
                        color: timerLeft === 0 ? "var(--red)" : timerLeft <= 5 ? "#f97316" : "var(--gold)"
                      }}>
                        {timerLeft}
                      </div>
                      <div style={{ margin: "8px 0 4px", height: 5, background: "var(--surf3)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 99,
                          width: `${(timerLeft / questionTime) * 100}%`,
                          background: timerLeft === 0 ? "var(--red)" : timerLeft <= 5 ? "#f97316" : "var(--gold)",
                          transition: "width 1s linear, background .3s"
                        }} />
                      </div>
                      {timerLeft === 0 && <div style={{ color: "var(--red)", fontSize: 11, fontWeight: 700, marginTop: 4 }}>Time's up!</div>}
                    </div>
                  )}

                  <button className="ctrl-btn btn-green" onClick={correct}>
                    ✓ Correct <span style={{ fontWeight: 400, fontSize: 12, color: "#86efac" }}>+{aq.points}</span>
                  </button>
                  <button className="ctrl-btn btn-red" onClick={wrong}>
                    ✗ Wrong <span style={{ fontWeight: 400, fontSize: 12, color: "#fca5a5" }}>0 pts</span>
                  </button>
                </div>
              )}

              {phase === "steal_offer" && (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="steal-box">
                    <div className="steal-title">⚡ Steal Available</div>
                    <div className="steal-info">{otherP?.name} — ±{Math.floor(aq.points / 2)} pts</div>
                  </div>
                  <button className="ctrl-btn btn-orange" onClick={() => upd({ phase: "steal" })}>
                    Steal!
                  </button>
                  <button className="ctrl-btn btn-ghost" onClick={skipSteal}>
                    Skip → Next Turn
                  </button>
                </div>
              )}

              {phase === "steal" && (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="muted" style={{ fontSize: 11, textAlign: "center", color: "#fb923c" }}>{otherP?.name} is stealing…</div>

                  {/* Timer for steal */}
                  {timerLeft === null ? (
                    <button className="btn-ghost btn-block" style={{ borderRadius: 8, padding: "9px", fontSize: 13 }} onClick={startTimer}>
                      ▶ Start Timer ({questionTime}s)
                    </button>
                  ) : (
                    <div style={{ textAlign: "center", background: "var(--surf2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 8px" }}>
                      <div style={{
                        fontSize: 46, fontWeight: 900, lineHeight: 1,
                        color: timerLeft === 0 ? "var(--red)" : timerLeft <= 5 ? "#f97316" : "var(--gold)"
                      }}>
                        {timerLeft}
                      </div>
                      <div style={{ margin: "8px 0 4px", height: 5, background: "var(--surf3)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 99,
                          width: `${(timerLeft / questionTime) * 100}%`,
                          background: timerLeft === 0 ? "var(--red)" : timerLeft <= 5 ? "#f97316" : "var(--gold)",
                          transition: "width 1s linear, background .3s"
                        }} />
                      </div>
                      {timerLeft === 0 && <div style={{ color: "var(--red)", fontSize: 11, fontWeight: 700, marginTop: 4 }}>Time's up!</div>}
                    </div>
                  )}

                  <button className="ctrl-btn btn-green" onClick={() => stealResult(true)}>
                    ✓ Correct <span style={{ fontWeight: 400, fontSize: 12, color: "#86efac" }}>+{Math.floor(aq.points / 2)}</span>
                  </button>
                  <button className="ctrl-btn btn-red" onClick={() => stealResult(false)}>
                    ✗ Wrong <span style={{ fontWeight: 400, fontSize: 12, color: "#fca5a5" }}>−{Math.floor(aq.points / 2)}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── Associations Panel ────────────────────────────────────────────────────────
function AssociationsPanel({ aq, turnP, otherP, phase, assocPoints, onAssocPointsChange, onCorrect, onWrong, onSteal, onSkipSteal, onStealCorrect, onStealWrong, onCancel }) {
  const half = Math.floor(assocPoints / 2);
  const revealed = (aq.revealedCells || []).length;
  const total = (aq.branches || []).reduce((a, b) => a + b.length, 0);

  return (
    <>
      <div style={{ background: "#1a0640", border: "1px solid #5020a0", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#9060d0", textTransform: "uppercase", letterSpacing: ".6px" }}>Associations</span>
          {phase === "answering" && <button onClick={onCancel} style={{ background: "none", color: "var(--muted)", fontSize: 13, padding: "1px 5px" }}>✕</button>}
        </div>
      </div>
      <hr className="divider" />
      {phase === "answering" && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="muted" style={{ fontSize: 11, textAlign: "center" }}>{turnP?.name} is answering…</div>
          <div style={{ background: "var(--surf2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>
              Award points
            </div>
            <input type="text" inputMode="numeric" value={assocPoints || ""}
              placeholder="Enter points…"
              onChange={e => {
                const clean = e.target.value.replace(/[^0-9]/g, "").replace(/^0+(\d)/, "$1");
                onAssocPointsChange(clean === "" ? 0 : parseInt(clean));
              }}
              style={{ textAlign: "center", fontWeight: 900, fontSize: 18, marginBottom: 8 }} />
            <button className="ctrl-btn btn-green" onClick={onCorrect} style={{ width: "100%" }} disabled={!assocPoints}>
              ✓ Award {assocPoints ? `+${assocPoints} pts` : ""}
            </button>
          </div>
          <button className="ctrl-btn btn-red" onClick={onWrong}>
            ✗ Wrong <span style={{ fontWeight: 400, fontSize: 12, color: "#fca5a5" }}>0 pts</span>
          </button>
        </div>
      )}
      {phase === "steal_offer" && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="steal-box">
            <div className="steal-title">⚡ Steal Available</div>
            <div className="steal-info">{otherP?.name} — ±{half} pts</div>
          </div>
          <button className="ctrl-btn btn-orange" onClick={onSteal}>Steal!</button>
          <button className="ctrl-btn btn-ghost" onClick={onSkipSteal}>Skip → Next Turn</button>
        </div>
      )}
      {phase === "steal" && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="muted" style={{ fontSize: 11, textAlign: "center", color: "#fb923c" }}>{otherP?.name} is stealing…</div>
          <button className="ctrl-btn btn-green" onClick={onStealCorrect}>
            ✓ Correct <span style={{ fontWeight: 400, fontSize: 12, color: "#86efac" }}>+{half}</span>
          </button>
          <button className="ctrl-btn btn-red" onClick={onStealWrong}>
            ✗ Wrong <span style={{ fontWeight: 400, fontSize: 12, color: "#fca5a5" }}>−{half}</span>
          </button>
        </div>
      )}
    </>
  );
}

// ─── Association Tree View ────────────────────────────────────────────────────
// Labels: top-left=A, top-right=B, bottom-left=C, bottom-right=D
// Numbers: 1 = outermost (furthest), N = innermost (closest to center)
// Spacing auto-scales so all cells fit regardless of N
// ─── Association Tree View ────────────────────────────────────────────────────
// Positions are computed so everything always fits:
//   - innermost cell starts just past the center cell edge
//   - outermost cell ends near the screen corner
//   - cell width scales so no horizontal overlap between adjacent cells
// ─── Association Tree View ────────────────────────────────────────────────────
// Excel-style tiling: N cells fill the space from center-edge to screen-edge
// exactly. Width = availableX/N, Height = availableY/N. Always fits, never gaps.
// ─── Association Tree View ────────────────────────────────────────────────────
// Decoupled sizing: cell DISPLAY size is fixed, step size drives POSITION only.
// No overlap guaranteed because stepY > CELL_H for any N ≤ 7 (max configured).
// Proof: stepY = AY/N = 35/7 = 5 > CELL_H = 4. ✓
// Horizontally: consecutive branch cells share x-range but NOT y-range → no overlap.
// Between branches (e.g. A vs C same x, different y): gap = 2*CY - CELL_H > 0. ✓
// ─── Association Tree View ────────────────────────────────────────────────────
// Math proof of no overlap:
//   stepY = AY/N  |  cellH = stepY * 0.82
//   Adjacent cells differ by stepY in Y → step_Y > cellH → no Y overlap → no overlap.
//   Cell width (17%) can exceed stepX safely because Y ranges don't overlap.
//   All cells fit: outermost at CX + (N-0.5)*stepX ≤ CX + AX = 50% ✓
// ─── Association Tree View ────────────────────────────────────────────────────
// All cells identical size — determined by the longest word across all branches.
// ─── Build a Card Game ────────────────────────────────────────────────────────
function BuildACardGame({ aq, turnP, otherP, phase, onAssign, onAwardPoints, onFinish, onCancel }) {
  const [selected, setSelected] = useState(null);
  const assigned = aq.assigned || { mana: null, attack: null, health: null, keywords: [] };
  const numbers  = aq.numbers  || [];
  const keywords = aq.keywords || [];
  const half = Math.floor((aq._pts || 0) / 2);
  const usedNumIndices = new Set([assigned.mana, assigned.attack, assigned.health].filter(v => v !== null));

  const selectNum = (idx) => { if (usedNumIndices.has(idx)) return; setSelected(selected?.type==="number"&&selected.idx===idx?null:{type:"number",idx}); };
  const selectKw  = (idx) => { if ((assigned.keywords||[]).includes(idx)) return; setSelected(selected?.type==="keyword"&&selected.idx===idx?null:{type:"keyword",idx}); };
  const clickSlot = async (slot) => {
    if (phase!=="answering") return;
    if (slot==="keyword") { if (selected?.type==="keyword"){await onAssign("keyword_add",selected.idx);setSelected(null);} }
    else { if (selected?.type==="number"){await onAssign(slot,selected.idx);setSelected(null);} else if(assigned[slot]!==null){await onAssign(slot,null);} }
  };
  const removeKw = async (pos) => { if (phase!=="answering") return; await onAssign("keyword_remove",pos); };
  const reset = async () => { setSelected(null); await onAssign("reset",null); };

  const slotStyle = (active,filled) => ({ background:filled?"#0a2840":active?"rgba(74,158,255,0.12)":"rgba(255,255,255,0.04)", border:`2px solid ${active?"#4a9eff":filled?"#4a9eff":"rgba(255,255,255,0.2)"}`, cursor:phase==="answering"?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:6, transition:"all .2s", color:filled?"#e8f4ff":"rgba(255,255,255,0.3)", fontWeight:800, fontFamily:"'Barlow Condensed',sans-serif" });

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:20,background:"#03082a"}}>
        <div style={{position:"relative",width:"min(340px,48%)",aspectRatio:"0.72",background:"linear-gradient(160deg,#0d1f3c,#061228)",border:"2px solid #2a4a7a",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,50,0.8)",overflow:"hidden"}}>
          <div onClick={()=>clickSlot("mana")} style={{...slotStyle(phase==="answering"&&selected?.type==="number"&&assigned.mana===null,assigned.mana!==null),position:"absolute",top:10,left:10,width:48,height:48,borderRadius:"50%",fontSize:22}}>{assigned.mana!==null?numbers[assigned.mana]:"?"}</div>
          <div onClick={()=>clickSlot("keyword")} style={{...slotStyle(phase==="answering"&&selected?.type==="keyword",(assigned.keywords||[]).length>0),position:"absolute",left:"10%",right:"10%",top:"52%",minHeight:44,flexDirection:"column",gap:4,padding:"6px 10px"}}>
            {(assigned.keywords||[]).length===0?<span style={{fontSize:12}}>KEYWORD</span>:<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{(assigned.keywords||[]).map((ki,pos)=><span key={pos} onClick={e=>{e.stopPropagation();removeKw(pos);}} style={{background:"rgba(74,158,255,0.2)",border:"1px solid #4a9eff",borderRadius:4,padding:"1px 8px",fontSize:12,fontWeight:700,color:"#a8d8ff",cursor:"pointer"}}>{keywords[ki]} ✕</span>)}</div>}
          </div>
          <div onClick={()=>clickSlot("attack")} style={{...slotStyle(phase==="answering"&&selected?.type==="number"&&assigned.attack===null,assigned.attack!==null),position:"absolute",bottom:12,left:12,width:52,height:52,borderRadius:8,fontSize:24}}>{assigned.attack!==null?numbers[assigned.attack]:"?"}</div>
          <div onClick={()=>clickSlot("health")} style={{...slotStyle(phase==="answering"&&selected?.type==="number"&&assigned.health===null,assigned.health!==null),position:"absolute",bottom:12,right:12,width:52,height:52,borderRadius:8,fontSize:24}}>{assigned.health!==null?numbers[assigned.health]:"?"}</div>
        </div>
      </div>
      <div className="ctrl-panel" style={{minWidth:280}}>
        <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>🃏 Build-a-Card {phase==="answering"?`— ${turnP?.name}`:""}</div>
        {aq.imageUrl&&<div style={{marginBottom:10}}><a href={aq.imageUrl} target="_blank" rel="noreferrer" style={{display:"block",textDecoration:"none"}}><img src={aq.imageUrl} alt="card" style={{width:"100%",maxHeight:130,objectFit:"contain",borderRadius:6,cursor:"pointer",display:"block",marginBottom:3}} onError={e=>{e.target.style.display="none";}}/><div style={{textAlign:"center",fontSize:10,color:"var(--gold)"}}>Open full size ↗</div></a><hr className="divider" style={{marginTop:8}}/></div>}
        {phase==="answering"&&<>
          {numbers.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:700,marginBottom:5}}>NUMBERS — click then assign to slot</div><div className="row gap2 wrap">{numbers.map((n,i)=>{const isUsed=usedNumIndices.has(i),isSel=selected?.type==="number"&&selected.idx===i;return <button key={i} onClick={()=>!isUsed&&selectNum(i)} style={{padding:"6px 14px",borderRadius:8,fontWeight:900,fontSize:16,fontFamily:"'Barlow Condensed',sans-serif",background:isUsed?"var(--surf3)":isSel?"var(--gold)":"var(--surf2)",border:`1.5px solid ${isUsed?"var(--dim)":isSel?"var(--gold)":"var(--border)"}`,color:isUsed?"var(--dim)":isSel?"#04091e":"var(--text)",cursor:isUsed?"default":"pointer",opacity:isUsed?0.45:1,textDecoration:isUsed?"line-through":"none"}}>{n}</button>})}</div></div>}
          {keywords.length>0&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:700,marginBottom:5}}>KEYWORDS — click then assign</div><div className="row gap2 wrap">{keywords.map((k,i)=>{const isUsed=(assigned.keywords||[]).includes(i),isSel=selected?.type==="keyword"&&selected.idx===i;return <button key={i} onClick={()=>!isUsed&&selectKw(i)} style={{padding:"5px 12px",borderRadius:8,fontWeight:700,fontSize:13,background:isUsed?"var(--surf3)":isSel?"var(--gold)":"var(--surf2)",border:`1.5px solid ${isUsed?"var(--dim)":isSel?"var(--gold)":"var(--border)"}`,color:isUsed?"var(--dim)":isSel?"#04091e":"var(--text)",cursor:isUsed?"default":"pointer",opacity:isUsed?0.45:1}}>{k}</button>})}</div></div>}
          {selected&&<div style={{padding:"6px 10px",background:"rgba(245,197,24,.08)",border:"1px solid rgba(245,197,24,.3)",borderRadius:6,marginBottom:8,fontSize:12,color:"var(--gold)",fontWeight:700}}>Selected: {selected.type==="number"?numbers[selected.idx]:keywords[selected.idx]} — click a slot on the card</div>}
          <hr className="divider"/>
          <Btn variant="ghost" block size="sm" onClick={reset} style={{marginBottom:8}}>↺ Reset Card</Btn>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".6px",marginBottom:5}}>Award points</div>
            <input type="text" inputMode="numeric" value={aq._pts??""} placeholder="Enter points..."
              onChange={e=>{const c=e.target.value.replace(/[^0-9]/g,"").replace(/^0+(\d)/,"$1");onAssign("_pts",c===""?"":parseInt(c));}}
              style={{textAlign:"center",fontWeight:900,fontSize:18,marginBottom:8}}/>
            <button className="ctrl-btn btn-green" onClick={()=>onAwardPoints(aq._pts||0)} disabled={!aq._pts} style={{width:"100%"}}>
              ✓ Award {aq._pts?`+${aq._pts} pts`:""}
            </button>
          </div>
          <hr className="divider"/>
          <button className="ctrl-btn btn-ghost" onClick={onFinish}>End Card</button>
        </>}
      </div>
    </div>
  );
}

// ─── Association Tree View (sizer-based uniform cells) ────────────────────────
// Technique: invisible "sizer" span with longestWord in every cell → all cells
// always exactly the same width, before AND after reveal. No layout shifts.
function AssociationTreeView({ puzzle, onRevealCell, onRevealCenter }) {
  const DIRS   = [{ dx:-1, dy:-1 }, { dx:1, dy:-1 }, { dx:-1, dy:1 }, { dx:1, dy:1 }];
  const LABELS = ["A", "B", "C", "D"];

  const branches     = (puzzle.branches || []).slice(0, 4);
  const revealed     = new Set(puzzle.revealedCells || []);
  const centerRevealed = !!puzzle.centerRevealed;
  const canReveal    = !!onRevealCell;

  // Longest word across all branches + center → sets uniform width
  const allWords = branches.flatMap(b => b).concat([puzzle.answer || ""]);
  const longestWord = allWords.reduce((a, b) => a.length > b.length ? a : b, "xxxxxxxx");

  // Palette
  const BG       = "#03082a";
  const CELL_BG  = "#0d1d50";
  const CTR_BG   = "#142060";
  const BORDER_H = "#5a8aff";
  const BORDER_L = "rgba(90,138,255,0.28)";
  const BORDER_C = "#7aa0ff";
  const TEXT_C   = "#dce8ff";
  const LABEL_C  = "rgba(180,210,255,0.55)";

  const FONT = 15;
  const FONT_BIG = 19; // center is slightly bigger
  const FONT_W = 900;
  const PX = "14px";  // horizontal padding
  const PY = "8px";   // vertical padding

  // Positioning
  const CX = 12, CY = 7;
  const AX = 27, AY = 36;

  // Renders a cell: invisible sizer (longestWord) + actual word on top
  const Cell = ({ word, isRevealed, isCenter, onClick: handleClick, style: extraStyle = {} }) => {
    const fs = isCenter ? FONT_BIG : FONT;
    return (
      <div
        onClick={handleClick}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: `${PY} ${PX}`,
          background: isRevealed ? (isCenter ? CTR_BG : CELL_BG) : BG,
          border: `${isCenter ? 3 : 2}px solid ${isRevealed ? (isCenter ? BORDER_C : BORDER_H) : BORDER_L}`,
          borderRadius: 5,
          cursor: handleClick ? "pointer" : "default",
          transition: "border-color .25s, background .25s",
          boxShadow: isCenter && isRevealed ? "0 0 24px rgba(90,138,255,0.4)" : isRevealed ? "0 0 8px rgba(90,138,255,0.15)" : "none",
          whiteSpace: "nowrap",
          ...extraStyle,
        }}>
        {/* Invisible sizer — always longestWord → uniform width */}
        <span style={{ opacity: 0, fontSize: fs, fontWeight: FONT_W, whiteSpace: "nowrap", pointerEvents: "none", userSelect: "none" }}>
          {longestWord}
        </span>
        {/* Actual word — transparent until revealed */}
        <span style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%,-50%)",
          fontSize: fs, fontWeight: FONT_W, whiteSpace: "nowrap",
          color: isRevealed ? TEXT_C : "transparent",
          transition: "color .25s",
        }}>
          {word || ""}
        </span>
      </div>
    );
  };

  return (
    <div style={{ width:"100%", height:"100%", background:BG, position:"relative", overflow:"hidden" }}>

      {/* Center */}
      <Cell
        word={puzzle.answer || ""}
        isRevealed={centerRevealed}
        isCenter
        onClick={!centerRevealed && onRevealCenter ? onRevealCenter : null}
        style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", zIndex:10 }}
      />

      {/* Branch words */}
      {branches.map((words, bi) => {
        const dir   = DIRS[bi]   || DIRS[0];
        const label = LABELS[bi] || String.fromCharCode(65 + bi);
        const n     = words.length;
        if (!n) return null;

        const stepX  = AX / n;
        const stepY  = AY / n;
        const cellHPct = stepY * 0.82; // < stepY → no vertical overlap

        return words.map((word, wi) => {
          const key      = `${bi}-${wi}`;
          const isRev    = revealed.has(key);
          const stepsOut = n - 1 - wi;
          const cellLabel = `${label}${wi + 1}`;
          const xOff = CX + (stepsOut + 0.5) * stepX;
          const yOff = CY + (stepsOut + 0.5) * stepY;

          return (
            <div key={key} style={{
              position:"absolute",
              left:`calc(50% + ${dir.dx * xOff}%)`,
              top: `calc(50% + ${dir.dy * yOff}%)`,
              transform:"translate(-50%,-50%)",
              zIndex:5,
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
            }}>
              <Cell
                word={word}
                isRevealed={isRev}
                isCenter={false}
                onClick={!isRev && canReveal ? () => onRevealCell(bi, wi) : null}
                style={{ height:`${cellHPct}%` }}
              />
            </div>
          );
        });
      })}
    </div>
  );
}

// ─── Connections Editor ────────────────────────────────────────────────────────
function ConnectionsEditor({ conn, onChange }) {
  const [ai, setAi] = useState(0);
  const rounds = conn.rounds || [];
  const freshConnRound = () => ({ id: uid(), pairCount: 5, pairs: Array.from({length:5},()=>({id:uid(),a:"",b:""})) });

  const addRound = () => { onChange({...conn, rounds:[...rounds, freshConnRound()]}); setAi(rounds.length); };
  const removeRound = id => { onChange({...conn, rounds:rounds.filter(r=>r.id!==id)}); setAi(0); };
  const updRound = (id, patch) => onChange({...conn, rounds:rounds.map(r=>r.id!==id?r:{...r,...patch})});

  const setPairCount = (id, n) => {
    const r = rounds.find(x=>x.id===id);
    let pairs = [...r.pairs];
    while (pairs.length < n) pairs.push({id:uid(),a:"",b:""});
    pairs = pairs.slice(0,n);
    updRound(id, {pairCount:n, pairs});
  };
  const setPairWord = (rid, pid, field, val) => {
    const r = rounds.find(x=>x.id===rid);
    updRound(rid, {pairs: r.pairs.map(p=>p.id!==pid?p:{...p,[field]:val})});
  };

  const idx = Math.min(ai, Math.max(0, rounds.length-1));
  const cur = rounds[idx];

  return (
    <Card>
      <div className="row gap2" style={{marginBottom:14}}>
        <SectionLabel style={{margin:0,flex:1}}>Connections — Rounds</SectionLabel>
        <Btn size="sm" onClick={addRound}>+ Add Round</Btn>
      </div>
      {rounds.length===0 && <div className="muted" style={{textAlign:"center",padding:"20px 0",fontSize:13}}>No rounds yet — click "Add Round".</div>}
      {rounds.length>0 && <>
        <div className="row gap2 wrap" style={{marginBottom:14}}>
          {rounds.map((r,i)=>(
            <button key={r.id} onClick={()=>setAi(i)} className={`topic-tab${i===idx?" on":""}`}>Round {i+1}</button>
          ))}
        </div>
        {cur && (
          <div className="q-editor fade">
            <div className="row gap3 wrap" style={{marginBottom:14,alignItems:"center"}}>
              <div>
                <label style={{fontSize:11,color:"var(--muted)",fontWeight:600,display:"block",marginBottom:5}}>Pairs per round</label>
                <select value={cur.pairCount||5} onChange={e=>setPairCount(cur.id,+e.target.value)}>
                  {[2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <Btn variant="ghost" size="sm" style={{color:"#f87171",marginTop:20}} onClick={()=>removeRound(cur.id)}>🗑 Delete</Btn>
            </div>
            <div className="row gap2" style={{marginBottom:8}}>
              <div style={{flex:1,fontSize:11,color:"var(--muted)",fontWeight:700,textAlign:"center"}}>Column A</div>
              <div style={{flex:1,fontSize:11,color:"var(--muted)",fontWeight:700,textAlign:"center"}}>Column B (matches A)</div>
            </div>
            <div className="stack" style={{gap:8}}>
              {(cur.pairs||[]).map((p,pi)=>(
                <div key={p.id} className="row gap2">
                  <span className="muted" style={{fontSize:11,minWidth:20,textAlign:"right"}}>{pi+1}.</span>
                  <input type="text" value={p.a} onChange={e=>setPairWord(cur.id,p.id,"a",e.target.value)} placeholder={`A${pi+1}`} style={{flex:1}} />
                  <span className="muted" style={{fontSize:16}}>↔</span>
                  <input type="text" value={p.b} onChange={e=>setPairWord(cur.id,p.id,"b",e.target.value)} placeholder={`B${pi+1}`} style={{flex:1}} />
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </Card>
  );
}

// ─── Connections Game ──────────────────────────────────────────────────────────
function ConnectionsGame({ aq, turnP, phase, onUpdateQ, onAwardPoints, onFinish }) {
  const [ptsInput, setPtsInput] = useState("");
  const [flash, setFlash] = useState(null);

  const { pairs, colA, colB, matched, selectedA } = aq;
  const matchedSet = new Set(matched || []);
  const allMatched = matchedSet.size === (pairs||[]).length;

  const clickA = async (pairId) => {
    if (phase !== "answering") return;
    if (matchedSet.has(pairId)) return;
    await onUpdateQ({ selectedA: selectedA === pairId ? null : pairId });
  };

  const clickB = async (pairId) => {
    if (phase !== "answering" || !selectedA) return;
    if (matchedSet.has(pairId)) return;
    const correct = pairId === selectedA;
    setFlash({ pairId: selectedA, bPairId: pairId, correct });
    setTimeout(() => setFlash(null), 1000);
    if (correct) {
      await onUpdateQ({ matched: [...(matched||[]), pairId], selectedA: null });
    } else {
      await onUpdateQ({ selectedA: null });
    }
  };

  const awardPts = async () => {
    const pts = parseInt(ptsInput) || 0;
    if (pts > 0) await onAwardPoints(pts);
    setPtsInput("");
  };

  const MATCH_COLORS = ["#22c55e","#3b82f6","#a855f7","#f97316","#ec4899","#eab308","#14b8a6","#ef4444"];
  const getMatchColor = (pairId) => { const idx = (matched||[]).indexOf(pairId); return idx >= 0 ? MATCH_COLORS[idx % MATCH_COLORS.length] : null; };

  const wordBtn = (pairId, word, side, isSelected, isMatched, matchColor, flashObj) => {
    let bg = "var(--surf2)", border = "var(--border)", color = "var(--text)", cursor = "pointer";
    if (isMatched) { bg = `${matchColor}22`; border = matchColor; color = matchColor; cursor = "default"; }
    else if (isSelected) { bg = "rgba(245,197,24,.15)"; border = "var(--gold)"; color = "var(--gold)"; }
    else if (flashObj && !flashObj.correct) { bg = "rgba(239,68,68,.15)"; border = "#ef4444"; color = "#ef4444"; }
    else if (flashObj && flashObj.correct) { bg = "rgba(34,197,94,.15)"; border = "#22c55e"; color = "#22c55e"; }
    const onClick = side === "A" ? () => clickA(pairId) : () => clickB(pairId);
    return (
      <button key={pairId} onClick={onClick}
        style={{ width:"100%", padding:"12px 16px", borderRadius:8, fontWeight:700, fontSize:15, background:bg, border:`2px solid ${border}`, color, cursor, transition:"all .2s", textAlign:"center", marginBottom:8 }}>
        {word}{isMatched && <span style={{marginLeft:8,fontSize:11,opacity:.7}}>✓</span>}
      </button>
    );
  };

  return (
    <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      <div style={{flex:1,padding:20,display:"flex",gap:16,overflow:"auto"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:12,textAlign:"center"}}>Column A</div>
          {(colA||[]).map(({pairId,word})=>wordBtn(pairId,word,"A",selectedA===pairId,matchedSet.has(pairId),getMatchColor(pairId),flash&&flash.pairId===pairId?flash:null))}
        </div>
        <div style={{width:2,background:"var(--border)",flexShrink:0,borderRadius:2}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--muted)",textTransform:"uppercase",letterSpacing:1,marginBottom:12,textAlign:"center"}}>Column B</div>
          {(colB||[]).map(({pairId,word})=>wordBtn(pairId,word,"B",false,matchedSet.has(pairId),getMatchColor(pairId),flash&&flash.bPairId===pairId?flash:null))}
        </div>
      </div>
      <div className="ctrl-panel">
        <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>🔀 Connections</div>
        <div style={{fontSize:12,color:"var(--muted)",marginBottom:12}}>{matchedSet.size}/{(pairs||[]).length} pairs matched</div>
        {phase==="answering" && <>
          {selectedA ? (
            <div style={{padding:"8px 12px",background:"rgba(245,197,24,.08)",border:"1px solid rgba(245,197,24,.3)",borderRadius:8,marginBottom:12,fontSize:12,color:"var(--gold)",fontWeight:700}}>
              Selected: {(colA||[]).find(x=>x.pairId===selectedA)?.word} — click Column B
            </div>
          ) : (
            <div className="muted" style={{fontSize:12,marginBottom:12}}>{allMatched?"All pairs matched!":`${turnP?.name}: click Column A`}</div>
          )}
          <hr className="divider"/>
          <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".6px",marginBottom:6}}>Award points</div>
          <input type="text" inputMode="numeric" value={ptsInput} placeholder="Enter points..."
            onChange={e=>{const c=e.target.value.replace(/[^0-9]/g,"").replace(/^0+(\d)/,"$1");setPtsInput(c);}}
            style={{textAlign:"center",fontWeight:900,fontSize:18,marginBottom:8}}/>
          <button className="ctrl-btn btn-green" onClick={awardPts} disabled={!ptsInput} style={{marginBottom:6}}>
            ✓ Award {ptsInput?`+${ptsInput} pts`:""}
          </button>
          <hr className="divider"/>
          <button className="ctrl-btn btn-ghost" onClick={onFinish}>{allMatched?"✓ Finish Round":"End Round Early"}</button>
        </>}
      </div>
    </div>
  );
}
