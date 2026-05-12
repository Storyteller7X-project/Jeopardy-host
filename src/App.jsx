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
const freshShow = () => ({
  id: uid(), name: "New Show", createdAt: Date.now(), updatedAt: Date.now(),
  miniGames: ["trivia"],
  trivia: { topicCount: 2, questionsPerTopic: 5, questionTime: 25, topics: [] }
});

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

function buildBoard(tr) {
  return syncTopics(tr).topics.map(t => ({
    name: t.name || "—",
    qs: [...t.questions].sort((a, b) => a.points - b.points).map(q => ({ id: q.id, text: q.text, points: q.points, done: false }))
  }));
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
  const [game, setGame] = useState(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    sGet("jshows").then(d => { if (d) setShows(d); });
    sGet("jgame").then(d => { if (d) setGame(d); });
  }, []);

  const saveShows = async s => { setShows(s); await sSet("jshows", s); };
  const saveGame = async g => { setGame(g); if (g) await sSet("jgame", g); else await sDel("jgame"); };

  if (view === "login") return <Login onLogin={() => setView("dash")} />;
  if (view === "dash") return (
    <Dashboard shows={shows} game={game}
      onNew={() => { setEditing(freshShow()); setView("edit"); }}
      onEdit={s => { setEditing(s); setView("edit"); }}
      onDelete={async id => saveShows(shows.filter(s => s.id !== id))}
      onPlay={s => {
        if (game && game.showId !== s.id) {
          if (!confirm("Start a new game? Current game will be lost.")) return;
        }
        if (game?.showId === s.id) { setView("game"); return; }
        setEditing(s); setView("psetup");
      }}
      onResume={() => setView("game")}
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
        const g = { showId: editing.id, showName: editing.name, trivia: syncTopics(editing.trivia), players, bracket, matches: {}, activeMatchId: null, subView: "bracket" };
        await saveGame(g); setView("game");
      }}
      onCancel={() => setView("dash")}
    />
  );
  if (view === "game" && game) return <GameView game={game} onUpdate={saveGame} onBack={() => setView("dash")} />;
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
function Dashboard({ shows, game, onNew, onEdit, onDelete, onPlay, onResume, onLogout }) {
  return (
    <div className="app">
      <div className="header">
        <div className="flex1">
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 18, color: "var(--gold)" }}>JEOPARDY HOST</div>
          <div className="muted" style={{ fontSize: 11 }}>Show Manager</div>
        </div>
        {game && <Btn variant="green" size="sm" onClick={onResume}>▶ Resume Game</Btn>}
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
              const isActive = game?.showId === s.id;
              return (
                <div key={s.id} className={`card show-row fade`} style={{ borderColor: isActive ? "rgba(245,197,24,.4)" : "" }}>
                  <div className="flex1" style={{ minWidth: 0 }}>
                    <div className="row gap2" style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "var(--gold)" }}>{s.name}</span>
                      {isActive && <span className="tag tag-gold">● Active</span>}
                    </div>
                    <div className="row gap3 muted" style={{ fontSize: 11, flexWrap: "wrap" }}>
                      <span>📚 {filledTopics}/{s.trivia?.topicCount || 0} topics</span>
                      <span>❓ {totalQ} questions</span>
                      <span>🕐 {new Date(s.updatedAt).toLocaleDateString()}</span>
                      {(s.miniGames || []).map(g => <span key={g} className="tag tag-gold">{g}</span>)}
                    </div>
                  </div>
                  <div className="row gap2">
                    <Btn variant="ghost" size="sm" onClick={() => onEdit(s)}>✏️ Edit</Btn>
                    <Btn variant="ghost" size="sm" style={{ color: "#f87171" }} onClick={() => { if (confirm(`Delete "${s.name}"?`)) onDelete(s.id); }}>🗑</Btn>
                    <Btn size="sm" onClick={() => onPlay(s)}>▶ Play</Btn>
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
  const upd = p => onChange({ ...show, ...p });
  const GAMES = [
    { id: "trivia",       label: "Trivia",            icon: "❓", ok: true  },
    { id: "maths",        label: "Maths",              icon: "➕", ok: false },
    { id: "associations", label: "Associations",       icon: "🔗", ok: false },
    { id: "pairs",        label: "Pairs Connection",   icon: "🃏", ok: false },
  ];
  const toggle = id => {
    const mg = show.miniGames.includes(id) ? show.miniGames.filter(g => g !== id) : [...show.miniGames, id];
    upd({ miniGames: mg });
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
        <Card>
          <SectionLabel>Show Name</SectionLabel>
          <input type="text" value={show.name} onChange={e => upd({ name: e.target.value })} placeholder="Enter show name…" style={{ fontWeight: 700, fontSize: 16 }} />
        </Card>
        <Card>
          <SectionLabel>Mini-Games</SectionLabel>
          <div className="row gap2 wrap">
            {GAMES.map(g => (
              <button key={g.id} onClick={() => g.ok && toggle(g.id)}
                className={`mini-game-btn${show.miniGames.includes(g.id) ? " on" : ""}${!g.ok ? " disabled" : ""}`}>
                {g.icon} {g.label}
                {!g.ok && <span style={{ fontSize: 10, color: "var(--dim)" }}>soon</span>}
                {g.ok && show.miniGames.includes(g.id) && <span style={{ color: "#4ade80" }}>✓</span>}
              </button>
            ))}
          </div>
        </Card>
        {show.miniGames.includes("trivia") && (
          <TriviaEditor trivia={show.trivia} onChange={t => onChange({ ...show, trivia: t })} />
        )}
      </div>
    </div>
  );
}

// ─── Trivia Editor ────────────────────────────────────────────────────────────
function TriviaEditor({ trivia, onChange }) {
  const [activeT, setActiveT] = useState(0);
  const update = p => onChange(syncTopics({ ...trivia, ...p }));
  const synced = syncTopics(trivia);
  const ti = Math.min(activeT, synced.topics.length - 1);
  const setName = (idx, name) => onChange({ ...trivia, topics: trivia.topics.map((t, i) => i === idx ? { ...t, name } : t) });
  const setQ = (tidx, qidx, p) => onChange({
    ...trivia,
    topics: trivia.topics.map((t, ti2) => ti2 !== tidx ? t : { ...t, questions: t.questions.map((q, qi) => qi !== qidx ? q : { ...q, ...p }) })
  });
  const cur = synced.topics[ti];
  const filled = cur?.questions.filter(q => q.text).length || 0;

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
        {synced.topics.map((t, i) => (
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
            <input type="text" value={cur.name} onChange={e => setName(ti, e.target.value)} placeholder="e.g. Animals, Lore, History…" style={{ fontWeight: 700 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{filled}/{trivia.questionsPerTopic} questions filled</div>
          <div className="stack" style={{ gap: 8 }}>
            {cur.questions.map((q, qi) => (
              <div key={q.id} className="q-row">
                <span className="q-num">{qi + 1}.</span>
                <input type="text" value={q.text} onChange={e => setQ(ti, qi, { text: e.target.value })}
                  placeholder={`Question ${qi + 1}…`} style={{ flex: 1 }} />
                <div className="pts-row">
                  {PTS.map(p => (
                    <button key={p} onClick={() => setQ(ti, qi, { points: p })}
                      className={`pts-chip${q.points === p ? " on" : ""}`}>{p}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Play Setup ───────────────────────────────────────────────────────────────
function PlaySetup({ show, onStart, onCancel }) {
  const [count, setCount] = useState(4);
  const [players, setPlayers] = useState(() => Array.from({ length: 4 }, (_, i) => ({ id: uid(), name: "", color: PLAYER_COLORS[i] })));
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
            {[2, 4, 8].map(n => (
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
    const md = { p1: m.p1, p2: m.p2, scores: { [m.p1]: 0, [m.p2]: 0 }, board: buildBoard(game.trivia), turn: m.p1, phase: "picking", activeQ: null };
    await onUpdate({ ...game, activeMatchId: matchId, subView: "match", matches: { ...matches, [matchId]: md } });
  };

  return (
    <div className="app">
      <div className="header">
        <Btn variant="ghost" size="sm" onClick={onBack}>← Shows</Btn>
        <div style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 17, color: "var(--gold)" }}>🏆 {game.showName}</div>
        {champion && <span className="tag tag-gold" style={{ fontSize: 13 }}>🏆 Champion: {champion.name}</span>}
        <Btn variant="ghost" size="sm" style={{ color: "#f87171" }} onClick={async () => { if (confirm("End this game?")) { await onUpdate(null); onBack(); } }}>End Game</Btn>
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
  const { p1, p2, scores, board, turn, phase, activeQ } = md;
  const gp = id => game.players.find(p => p.id === id);
  const turnP = gp(turn), otherP = gp(turn === p1 ? p2 : p1);
  const aq = activeQ ? board[activeQ.ti].qs[activeQ.qi] : null;
  const questionTime = game.trivia.questionTime || 25;

  const [timerLeft, setTimerLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);

  // Reset timer whenever a new question is selected or steal phase begins
  useEffect(() => { setTimerLeft(null); setTimerRunning(false); }, [activeQ]);
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

  const upd = async patch => await onUpdate({ ...game, matches: { ...game.matches, [game.activeMatchId]: { ...md, ...patch } } });

  const markBoard = () => board.map((t, ti) => ({
    ...t, qs: t.qs.map((q, qi) => ti === activeQ.ti && qi === activeQ.qi ? { ...q, done: true } : q)
  }));

  const allDone = b => b.every(t => t.qs.every(q => q.done));

  const endMatch = async (fs, fb) => {
    const s1 = fs[p1] || 0, s2 = fs[p2] || 0;
    const winner = s1 > s2 ? p1 : s2 > s1 ? p2 : p1;
    const nb = advanceBracket(game.bracket, game.activeMatchId, winner);
    await onUpdate({ ...game, bracket: nb, activeMatchId: null, subView: "bracket", matches: { ...game.matches, [game.activeMatchId]: { ...md, phase: "done", scores: fs, board: fb, winner } } });
  };

  const correct = async () => {
    if (!aq) return;
    const nb = markBoard(); const ns = { ...scores, [turn]: (scores[turn] || 0) + aq.points }; const nxt = turn === p1 ? p2 : p1;
    if (allDone(nb)) await endMatch(ns, nb); else await upd({ phase: "picking", activeQ: null, board: nb, scores: ns, turn: nxt });
  };
  const wrong = async () => upd({ phase: "steal_offer" });
  const cancelQ = async () => upd({ phase: "picking", activeQ: null });
  const skipSteal = async () => {
    const nb = markBoard(); const nxt = turn === p1 ? p2 : p1;
    if (allDone(nb)) await endMatch(scores, nb); else await upd({ phase: "picking", activeQ: null, board: nb, turn: nxt });
  };
  const stealResult = async ok => {
    if (!aq) return;
    const half = Math.floor(aq.points / 2); const sid = turn === p1 ? p2 : p1;
    const nb = markBoard(); const ns = { ...scores, [sid]: (scores[sid] || 0) + (ok ? half : -half) };
    if (allDone(nb)) await endMatch(ns, nb); else await upd({ phase: "picking", activeQ: null, board: nb, scores: ns, turn: sid });
  };

  const phaseInfo = {
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
            const p = gp(pid); const active = isTurn(pid) || isSteal(pid);
            return (
              <div key={pid} className="score-pill" style={{ background: `${p?.color}16`, outline: active ? `1.5px solid ${p?.color}` : "1.5px solid transparent" }}>
                <div className="score-dot" style={{ background: p?.color }} />
                <span className="score-name" style={{ color: p?.color }}>{p?.name}</span>
                <span className="score-val">{scores[pid] ?? 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="phase-bar" style={{ background: `${phaseInfo.col}14`, color: phaseInfo.col }}>
        {phaseInfo.text}
      </div>

      <div className="game-body">
        <div className="board-area">
          <div className="board-wrap">
            <div className="board">
              {board.map((topic, ti) => (
                <div key={ti} className="board-col">
                  <div className="board-head">{topic.name || `Topic ${ti + 1}`}</div>
                  {topic.qs.map((q, qi) => {
                    const canClick = !q.done && phase === "picking";
                    return (
                      <div key={q.id}
                        className={`board-cell${q.done ? " used" : canClick ? " avail" : " locked"}`}
                        onClick={() => canClick && upd({ phase: "answering", activeQ: { ti, qi } })}>
                        {!q.done && q.points}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ctrl-panel">
          {!aq ? (
            <div className="wait-panel">
              <div style={{ fontSize: 42, opacity: .2 }}>👆</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: turnP?.color }}>{turnP?.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>Select a question from the board</div>
            </div>
          ) : (
            <>
              <div className="q-display">
                <div className="q-meta">
                  <span>{board[activeQ.ti].name} — <span style={{ color: "var(--gold)" }}>{aq.points} pts</span></span>
                  {phase === "answering" && (
                    <button onClick={cancelQ} style={{ background: "none", color: "var(--muted)", fontSize: 13, padding: "1px 5px" }}>✕</button>
                  )}
                </div>
                <div className="q-text">{aq.text || "(no question text)"}</div>
              </div>

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
      </div>
    </div>
  );
}
