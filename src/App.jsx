import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
// WORKOUT PROGRAM
// ─────────────────────────────────────────────
const WORKOUT_PROGRAM = {
  push: {
    label: "Push Day",
    emoji: "💪",
    color: "#FF6B35",
    exercises: [
      { id: "bench",   name: "Bench Press",     sets: 3, reps: 12, rest: 180, defaultWeight: 57.5 },
      { id: "shrugs",  name: "Shrugs",           sets: 3, reps: 15, rest: 120, defaultWeight: 15 },
      { id: "lateral", name: "Lateral Raises",   sets: 3, reps: 15, rest: 120, defaultWeight: 10 },
      { id: "fly",     name: "Dumbbell Fly",     sets: 3, reps: 15, rest: 120, defaultWeight: 10 },
      { id: "skull",   name: "Skullcrushers",    sets: 3, reps: 15, rest: 120, defaultWeight: 20 },
    ],
  },
  pull: {
    label: "Pull Day",
    emoji: "🔙",
    color: "#4ECDC4",
    exercises: [
      { id: "pullup",   name: "Pull Ups",        sets: 3, reps: 12, rest: 180, defaultWeight: 0 },
      { id: "bbrow",    name: "Barbell Row",     sets: 3, reps: 12, rest: 180, defaultWeight: 37.5 },
      { id: "pullover", name: "Lat Pullover",    sets: 3, reps: 15, rest: 120, defaultWeight: 15 },
      { id: "revfly",   name: "Reverse Fly",     sets: 3, reps: 15, rest: 120, defaultWeight: 6 },
      { id: "ezcurl",   name: "EZ Bar Curls",    sets: 3, reps: 15, rest: 120, defaultWeight: 15 },
    ],
  },
  legs: {
    label: "Leg Day",
    emoji: "🦵",
    color: "#A8E6CF",
    exercises: [
      { id: "squat",  name: "Squat",                  sets: 3, reps: 10, rest: 180, defaultWeight: 55 },
      { id: "rdl",    name: "Romanian Deadlift",      sets: 3, reps: 15, rest: 120, defaultWeight: 35 },
      { id: "calf",   name: "One Leg Calf Raises",    sets: 2, reps: 15, rest: 30,  defaultWeight: 0 },
      { id: "crunch", name: "Crunches",               sets: 2, reps: 15, rest: 30,  defaultWeight: 0 },
    ],
  },
  rest1: { label: "Rest Day", emoji: "😴", color: "#444", exercises: [] },
  upper: {
    label: "Upper Day",
    emoji: "🏋️",
    color: "#C77DFF",
    exercises: [
      { id: "bench_u",   name: "Bench Press",      sets: 3, reps: 8,  rest: 180, defaultWeight: 65 },
      { id: "bbrow_u",   name: "Barbell Row",      sets: 2, reps: 8,  rest: 180, defaultWeight: 45 },
      { id: "lateral_u", name: "Lateral Raises",   sets: 2, reps: 10, rest: 30,  defaultWeight: 10 },
      { id: "pullup_u",  name: "Pull Ups",         sets: 2, reps: 8,  rest: 60,  defaultWeight: 0 },
      { id: "fly_u",     name: "Dumbbell Fly",     sets: 2, reps: 10, rest: 120, defaultWeight: 10 },
      { id: "preacher",  name: "Preacher Curls",   sets: 2, reps: 10, rest: 30,  defaultWeight: 20 },
      { id: "skull_u",   name: "Skullcrushers",    sets: 2, reps: 10, rest: 30,  defaultWeight: 25 },
    ],
  },
  lower: {
    label: "Lower Day",
    emoji: "🔻",
    color: "#FFD166",
    exercises: [
      { id: "squat_l",  name: "Squat",                sets: 3, reps: 8,  rest: 180, defaultWeight: 60 },
      { id: "rdl_l",    name: "Romanian Deadlift",    sets: 3, reps: 10, rest: 120, defaultWeight: 45 },
      { id: "calf_l",   name: "One Leg Calf Raises",  sets: 2, reps: 10, rest: 30,  defaultWeight: 15 },
      { id: "crunch_l", name: "Crunches",             sets: 3, reps: 10, rest: 30,  defaultWeight: 0 },
    ],
  },
  rest2: { label: "Rest Day", emoji: "😴", color: "#444", exercises: [] },
};

const SCHEDULE = ["push", "pull", "legs", "rest1", "upper", "lower", "rest2"];

// ─────────────────────────────────────────────
// GOOGLE OAUTH  (Client ID is public — safe in frontend)
// ─────────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "YOUR_GOOGLE_CLIENT_ID";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

// ─────────────────────────────────────────────
// PROGRESSION LOGIC
// Increase after 2 consecutive sessions hitting all reps.
// ─────────────────────────────────────────────
function getProgression(exHistory, targetReps, currentWeight) {
  if (!exHistory || exHistory.length < 2) return null;
  const last2 = exHistory.slice(-2);
  const allHit = last2.every((s) =>
    s.sets?.every((st) => st.skipped || parseInt(st.reps) >= targetReps)
  );
  if (allHit) {
    const inc = currentWeight < 10 ? 0.5 : currentWeight < 30 ? 1.25 : 2.5;
    return { type: "increase", amount: inc };
  }
  const lastSession = last2[last2.length - 1];
  const bigMiss = lastSession.sets?.some(
    (st) => !st.skipped && parseInt(st.reps) < targetReps - 3
  );
  if (bigMiss) return { type: "hold" };
  return null;
}

// ─────────────────────────────────────────────
// LOCAL STORAGE HELPERS
// ─────────────────────────────────────────────
const ls = {
  get: (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0a0a0a; --s1:#141414; --s2:#1c1c1c; --s3:#242424;
  --border:#282828; --border2:#333;
  --text:#efefef; --muted:#555; --muted2:#888;
  --accent:#FF6B35; --green:#4CAF50; --green-bg:#0d200d; --green-border:#1a3a1a;
  --radius:14px; --radiussm:10px;
  --df:'Bebas Neue',sans-serif; --db:'DM Sans',sans-serif;
}
body{background:var(--bg);color:var(--text);font-family:var(--db);-webkit-tap-highlight-color:transparent;}
input[type=number]{-moz-appearance:textfield;}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
input[type=date]{color-scheme:dark;}

.app{max-width:430px;margin:0 auto;min-height:100svh;display:flex;flex-direction:column;position:relative;}

/* NAV */
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:var(--s1);border-top:1px solid var(--border);display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom,6px);}
.nbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px 6px;background:none;border:none;cursor:pointer;color:var(--muted);font-family:var(--db);font-size:10px;font-weight:500;letter-spacing:.4px;text-transform:uppercase;transition:color .15s;}
.nbtn.on{color:var(--accent);}
.nbtn svg{width:21px;height:21px;}

/* PAGE HEADER */
.phdr{padding:50px 18px 14px;background:var(--s1);border-bottom:1px solid var(--border);}
.phdr h1{font-family:var(--df);font-size:30px;letter-spacing:2px;}
.phdr p{color:var(--muted2);font-size:13px;margin-top:2px;}

/* SCROLL */
.scroll{flex:1;overflow-y:auto;padding:14px 14px 96px;-webkit-overflow-scrolling:touch;}

/* CARDS */
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:10px;}
.ctitle{font-family:var(--df);font-size:17px;letter-spacing:1px;margin-bottom:10px;}

/* BUTTONS */
.btn-accent{width:100%;padding:15px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-family:var(--df);font-size:19px;letter-spacing:2px;cursor:pointer;transition:opacity .15s,transform .1s;}
.btn-accent:active{transform:scale(.98);opacity:.88;}
.btn-ghost{background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:11px;color:var(--muted2);cursor:pointer;font-family:var(--db);}

/* HOME */
.day-badge{display:inline-block;font-family:var(--df);font-size:12px;letter-spacing:2px;padding:3px 10px;border-radius:20px;margin-bottom:6px;}
.day-label{font-family:var(--df);font-size:34px;letter-spacing:2px;}
.ex-preview{display:flex;flex-direction:column;gap:5px;margin:10px 0;}
.ex-row{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--s2);border-radius:8px;font-size:13px;}
.ex-row-name{font-weight:500;}
.ex-row-right{display:flex;align-items:center;gap:8px;}
.prog-pill{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--green-bg);color:#88cc88;border:1px solid var(--green-border);}

/* WEEK DOTS */
.week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:10px 0 6px;}
.wdot{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;background:var(--s2);color:var(--muted);}
.wdot.done{background:#0d200d;color:#88cc88;}
.wdot.today{outline:1.5px solid var(--accent);outline-offset:1px;}

/* STATS GRID */
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.stat-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--radius);padding:14px;}
.stat-label{font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;}
.stat-num{font-family:var(--df);font-size:34px;letter-spacing:1px;}

/* WORKOUT SESSION */
.w-header{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--s1);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;}
.back-btn{width:36px;height:36px;background:var(--s2);border:1px solid var(--border);border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);flex-shrink:0;}

/* EXERCISE CARD */
.ex-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--radius);margin:0 14px 12px;overflow:hidden;transition:border-color .2s;}
.ex-card.active-ex{border-color:var(--accent);}
.ex-card.ex-done{border-color:var(--green-border);}
.ex-card.ex-skip{opacity:.4;}
.ex-chead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);}
.ex-cname{font-weight:600;font-size:15px;}
.ex-cmeta{color:var(--muted);font-size:12px;margin-top:2px;}

/* AI BANNER */
.ai-banner{margin:0 14px 10px;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.5;border-left:2.5px solid var(--accent);background:#1a1008;color:#ffcc88;}
.ai-banner.good{border-color:var(--green);background:var(--green-bg);color:#88cc88;}

/* WEIGHT CONTROL */
.weight-row{display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 14px;background:var(--s2);border-bottom:1px solid var(--border);}
.w-btn{width:38px;height:38px;border-radius:50%;background:var(--s3);border:1px solid var(--border2);color:var(--text);font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;transition:background .1s;}
.w-btn:active{background:#333;}
.w-num{font-family:var(--df);font-size:28px;letter-spacing:.5px;min-width:85px;text-align:center;}
.w-lbl{font-size:11px;color:var(--muted);letter-spacing:1px;text-align:center;margin-top:-3px;}

/* SET BOXES */
.sets-row{display:flex;gap:8px;padding:12px 14px;}
.set-box{flex:1;border:1.5px solid var(--border);border-radius:12px;background:var(--s2);overflow:hidden;transition:border-color .15s,background .15s;position:relative;}
.set-box.set-done{border-color:var(--green-border);background:var(--green-bg);}
.set-box.set-skip{opacity:.35;pointer-events:none;}
.set-box-top{display:flex;justify-content:space-between;align-items:center;padding:7px 8px 3px;}
.set-num{font-size:10px;color:var(--muted);font-weight:600;letter-spacing:.3px;text-transform:uppercase;}
.set-done-ring{width:16px;height:16px;border-radius:50%;background:var(--green-bg);border:1.5px solid var(--green-border);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;}
.set-box.set-done .set-done-ring{opacity:1;}
.set-x{width:18px;height:18px;border-radius:4px;background:var(--s3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);cursor:pointer;flex-shrink:0;line-height:1;}
.set-x:hover{color:var(--text);}
.set-target{font-size:11px;color:var(--muted);text-align:center;padding:0 6px 3px;}
.set-target span{color:var(--muted2);}
.set-input{width:100%;background:var(--s3);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);font-size:26px;font-weight:700;text-align:center;padding:7px 4px 8px;outline:none;font-family:var(--db);transition:border-color .15s,background .15s,color .15s;display:block;margin:4px 6px 8px;width:calc(100% - 12px);}
.set-box.set-done .set-input{border-color:var(--green-border);background:#0a1a0a;color:#88cc88;}

/* REST TIMER */
.rest-overlay{position:fixed;inset:0;background:rgba(0,0,0,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;}
.rest-lbl{font-family:var(--df);font-size:16px;letter-spacing:4px;color:var(--muted);margin-bottom:6px;}
.rest-num{font-family:var(--df);font-size:100px;letter-spacing:3px;line-height:1;}
.rest-skip{margin-top:28px;padding:13px 36px;background:var(--s2);border:1px solid var(--border);border-radius:var(--radius);color:var(--muted2);font-family:var(--df);font-size:15px;letter-spacing:1px;cursor:pointer;}

/* NOTE */
.note-wrap{padding:0 14px 12px;}
.note-lbl{font-size:12px;color:var(--muted);margin-bottom:5px;}
.note-ta{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:var(--db);font-size:14px;padding:10px 12px;resize:none;min-height:64px;outline:none;}
.note-ta:focus{border-color:var(--border2);}

/* FINISH */
.finish-btn{display:block;width:calc(100% - 28px);margin:0 14px 14px;padding:15px;background:var(--green-bg);border:1px solid var(--green-border);border-radius:var(--radius);color:#88cc88;font-family:var(--df);font-size:19px;letter-spacing:2px;cursor:pointer;transition:background .15s;}
.finish-btn:hover{background:#102010;}

/* HISTORY */
.hist-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--radius);padding:13px;margin-bottom:9px;}
.hist-top{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;}
.hist-day{font-weight:600;font-size:15px;}
.hist-date{font-size:12px;color:var(--muted);margin-top:2px;}
.hist-dur{font-family:var(--df);font-size:13px;color:var(--muted2);}
.hist-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border);}
.hist-row:last-of-type{border-bottom:none;}
.hist-note{margin-top:7px;font-size:12px;color:var(--muted2);font-style:italic;}

/* CHAT */
.chat-wrap{display:flex;flex-direction:column;height:100svh;}
.chat-msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:8px;}
.msg{max-width:86%;}
.msg.user{align-self:flex-end;}
.msg.ai{align-self:flex-start;}
.bubble{padding:10px 13px;border-radius:15px;font-size:14px;line-height:1.6;}
.msg.user .bubble{background:var(--accent);color:#fff;border-bottom-right-radius:4px;}
.msg.ai .bubble{background:var(--s2);border:1px solid var(--border);border-bottom-left-radius:4px;}
.msg-time{font-size:10px;color:var(--muted);margin-top:2px;padding:0 3px;}
.chat-bar{display:flex;gap:8px;padding:10px 14px;background:var(--s1);border-top:1px solid var(--border);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));}
.chat-in{flex:1;background:var(--s2);border:1px solid var(--border);border-radius:22px;color:var(--text);font-family:var(--db);font-size:14px;padding:9px 15px;outline:none;}
.chat-in:focus{border-color:var(--border2);}
.send-btn{width:42px;height:42px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.typing{display:flex;gap:5px;align-items:center;padding:2px 0;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--muted2);animation:blink 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes blink{0%,80%,100%{opacity:.2;}40%{opacity:1;}}

/* SETTINGS */
.srow{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--border);}
.srow:last-child{border-bottom:none;}
.slbl{font-size:15px;}
.ssub{font-size:12px;color:var(--muted);margin-top:2px;}
.tog{width:44px;height:24px;border-radius:12px;background:var(--border2);position:relative;cursor:pointer;transition:background .2s;border:none;flex-shrink:0;}
.tog.on{background:var(--accent);}
.tog::after{content:'';position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;}
.tog.on::after{transform:translateX(20px);}

/* LOGIN */
.login{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:var(--bg);}
.login-logo{font-family:var(--df);font-size:64px;letter-spacing:5px;color:var(--accent);}
.login-tagline{color:var(--muted2);font-size:15px;margin:6px 0 48px;line-height:1.7;}
.google-btn{display:flex;align-items:center;gap:12px;padding:13px 26px;background:var(--s1);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-family:var(--db);font-size:16px;font-weight:500;cursor:pointer;margin-bottom:14px;transition:border-color .15s;}
.google-btn:hover{border-color:var(--accent);}
.demo-lnk{background:none;border:none;color:var(--muted2);font-family:var(--db);font-size:13px;cursor:pointer;text-decoration:underline;margin-top:4px;}
.login-note{color:var(--muted);font-size:12px;margin-top:36px;line-height:1.7;max-width:280px;}

/* SPINNER */
.spin{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:sp .7s linear infinite;display:inline-block;}
@keyframes sp{to{transform:rotate(360deg);}}

/* STREAK */
.streak-chip{display:flex;align-items:center;gap:5px;font-family:var(--df);font-size:14px;letter-spacing:1px;padding:5px 11px;background:var(--s2);border-radius:20px;border:1px solid var(--border);}

/* SYNC STATUS */
.sync-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;}
.sync-dot.ok{background:var(--green);}
.sync-dot.err{background:#cc4444;}
.sync-dot.pend{background:#ffaa33;}
`;

// ─────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────
const Ic = {
  Home: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  Dumbbell: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  Clock:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  Chat:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Cog:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Send:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Back:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  Check:    ()=><svg viewBox="0 0 10 8" fill="none" stroke="#88cc88" strokeWidth="2.5"><polyline points="1,4 4,7 9,1"/></svg>,
  Google:   ()=><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
};

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
export default function App() {
  const [user,    setUser]    = useState(() => ls.get("gr_user", null));
  const [tab,     setTab]     = useState("home");
  const [history, setHistory] = useState(() => ls.get("gr_history", []));
  const [weights, setWeights] = useState(() => ls.get("gr_weights", {}));
  const [sheetId, setSheetId] = useState(() => ls.get("gr_sheetId", null));
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | ok | err
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [restTimer,     setRestTimer]     = useState(null);
  const restRef = useRef(null);

  useEffect(() => { ls.set("gr_history", history); }, [history]);
  useEffect(() => { ls.set("gr_weights", weights); }, [weights]);
  useEffect(() => { if (user) ls.set("gr_user", user); }, [user]);

  // Today's workout day
  const startDate = ls.get("gr_start", null);
  const todayIdx  = startDate
    ? Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000) % 7
    : 0;
  const todayKey     = SCHEDULE[todayIdx];
  const todayWorkout = WORKOUT_PROGRAM[todayKey];

  const getWeight = (id, def) => weights[id] ?? def;

  // Rest timer
  const startRest = useCallback((secs) => {
    setRestTimer(secs);
    clearInterval(restRef.current);
    restRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t <= 1) { clearInterval(restRef.current); return null; }
        return t - 1;
      });
    }, 1000);
  }, []);

  // Finish workout → save locally + sync to Sheets
  const handleFinish = useCallback(async (session) => {
    const updated = [...history, session];
    setHistory(updated);
    setWeights(w => {
      const nw = { ...w };
      session.exercises.forEach(ex => { if (!ex.skipped) nw[ex.id] = ex.weight; });
      return nw;
    });
    setActiveWorkout(null);

    // Sync to Google Sheets if connected
    if (sheetId && user?.accessToken) {
      setSyncStatus("syncing");
      try {
        const r = await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "append", accessToken: user.accessToken, spreadsheetId: sheetId, session }),
        });
        setSyncStatus(r.ok ? "ok" : "err");
      } catch { setSyncStatus("err"); }
      setTimeout(() => setSyncStatus("idle"), 4000);
    }
  }, [history, sheetId, user]);

  // Demo login — no Google account needed
  const handleDemo = () => {
    const demo = { name: "Demo User", email: "demo@example.com", demo: true };
    if (!ls.get("gr_start", null)) ls.set("gr_start", new Date().toISOString());
    setUser(demo);
  };

  // Google OAuth login
  const handleLogin = async () => {
    if (GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID") {
      handleDemo();
      return;
    }
    // Real OAuth popup
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/auth/callback`,
      response_type: "token",
      scope: GOOGLE_SCOPES,
      prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  // Setup Google Sheets for new user
  const handleConnectSheets = async () => {
    if (!user?.accessToken) return alert("Sign in with Google first to enable Sheets sync.");
    setSyncStatus("syncing");
    try {
      const r = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", accessToken: user.accessToken }),
      });
      const d = await r.json();
      if (d.spreadsheetId) {
        setSheetId(d.spreadsheetId);
        ls.set("gr_sheetId", d.spreadsheetId);
        setSyncStatus("ok");
        alert("✅ Google Sheet created! Your workouts will sync automatically.");
      }
    } catch { setSyncStatus("err"); }
    setTimeout(() => setSyncStatus("idle"), 4000);
  };

  // Setup calendar reminders
  const handleCalendar = async () => {
    if (!user?.accessToken) return alert("Sign in with Google first.");
    const start = ls.get("gr_start", new Date().toISOString());
    const r = await fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: user.accessToken, startDate: start }),
    });
    const d = await r.json();
    if (d.ok) alert(`✅ ${d.eventsCreated} calendar reminders added for the next 4 weeks!`);
    else alert("Something went wrong. Make sure Calendar API is enabled.");
  };

  // Streak calculation
  const streak = history.filter(h => WORKOUT_PROGRAM[h.dayKey]?.exercises?.length > 0).length;

  // ── LOGIN SCREEN ──────────────────────────────────────
  if (!user) return (
    <>
      <style>{CSS}</style>
      <div className="login">
        <div className="login-logo">GRIND</div>
        <p className="login-tagline">Your free AI personal trainer.<br/>Track. Progress. Never skip leg day.</p>
        <button className="google-btn" onClick={handleLogin}><Ic.Google/> Continue with Google</button>
        <button className="demo-lnk" onClick={handleDemo}>Try without signing in</button>
        <p className="login-note">
          Signing in creates a personal Google Sheet for your workout history and adds calendar reminders — all free.
        </p>
      </div>
    </>
  );

  // ── ACTIVE WORKOUT ────────────────────────────────────
  if (activeWorkout) return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <WorkoutSession
          workout={activeWorkout}
          weights={weights}
          setWeights={setWeights}
          history={history}
          onFinish={handleFinish}
          onBack={() => setActiveWorkout(null)}
          startRest={startRest}
          getWeight={getWeight}
        />
        {restTimer !== null && (
          <div className="rest-overlay">
            <div className="rest-lbl">REST</div>
            <div className="rest-num" style={{ color: restTimer <= 10 ? "var(--accent)" : "var(--text)" }}>{restTimer}</div>
            <button className="rest-skip" onClick={() => { clearInterval(restRef.current); setRestTimer(null); }}>SKIP REST</button>
          </div>
        )}
      </div>
    </>
  );

  // ── MAIN TABS ─────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* ── HOME ── */}
        {tab === "home" && <>
          <div className="phdr">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div><h1>GRIND</h1><p>Hey {user.name?.split(" ")[0]} 👋</p></div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                <div className="streak-chip">🔥 {streak}</div>
                {syncStatus !== "idle" && (
                  <span style={{ fontSize:11, color:"var(--muted2)" }}>
                    <span className={`sync-dot ${syncStatus === "syncing" ? "pend" : syncStatus === "ok" ? "ok" : "err"}`}/>
                    {syncStatus === "syncing" ? "Syncing…" : syncStatus === "ok" ? "Synced" : "Sync error"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="scroll">
            {/* Today card */}
            <div className="card" style={{ borderColor: todayWorkout.color + "55" }}>
              <div className="day-badge" style={{ background: todayWorkout.color + "22", color: todayWorkout.color }}>TODAY</div>
              <div className="day-label">{todayWorkout.emoji} {todayWorkout.label}</div>

              {todayWorkout.exercises.length > 0 ? <>
                <div className="ex-preview">
                  {todayWorkout.exercises.map(ex => {
                    const exHist = history.flatMap(h => h.exercises?.filter(e => e.id === ex.id) ?? []);
                    const prog = getProgression(exHist, ex.reps, getWeight(ex.id, ex.defaultWeight));
                    return (
                      <div key={ex.id} className="ex-row">
                        <div>
                          <div className="ex-row-name">{ex.name}</div>
                          <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>{ex.sets}×{ex.reps} · {getWeight(ex.id, ex.defaultWeight)}kg</div>
                        </div>
                        <div className="ex-row-right">
                          {prog?.type === "increase" && <span className="prog-pill">↑ +{prog.amount}kg</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn-accent" onClick={() => setActiveWorkout({ key: todayKey, ...todayWorkout })}>
                  START WORKOUT
                </button>
              </> : (
                <p style={{ color:"var(--muted2)", marginTop:8, fontSize:14 }}>Recovery is part of the process. Rest up 🛌</p>
              )}
            </div>

            {/* Week overview */}
            <div className="card">
              <div className="ctitle">THIS WEEK</div>
              <div className="week-grid">
                {SCHEDULE.map((k, i) => {
                  const w = WORKOUT_PROGRAM[k];
                  const isToday = i === todayIdx;
                  const isRest  = w.exercises.length === 0;
                  const done    = history.some(h => {
                    const ws = new Date(); ws.setDate(ws.getDate() - todayIdx);
                    return h.dayKey === k && new Date(h.date) >= ws;
                  });
                  const letters = ["P","P","L","R","U","L","R"];
                  return <div key={k} className={`wdot ${done ? "done" : ""} ${isToday ? "today" : ""}`} title={w.label}>{letters[i]}</div>;
                })}
              </div>
              <div style={{ fontSize:11, color:"var(--muted)", display:"flex", gap:10 }}>
                <span>P = Push / Pull</span><span>L = Legs / Lower</span><span>U = Upper</span><span>R = Rest</span>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Sessions</div>
                <div className="stat-num">{history.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Leg days 😬</div>
                <div className="stat-num">{history.filter(h => h.dayKey === "legs" || h.dayKey === "lower").length}</div>
              </div>
            </div>
          </div>
        </>}

        {/* ── PROGRAM ── */}
        {tab === "workout" && <>
          <div className="phdr"><h1>PROGRAM</h1><p>Push · Pull · Legs · Rest · Upper · Lower · Rest</p></div>
          <div className="scroll">
            {SCHEDULE.map((k, i) => {
              const w = WORKOUT_PROGRAM[k];
              const isToday = i === todayIdx;
              return (
                <div key={k} className="card" style={{ borderColor: isToday ? w.color : undefined }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontFamily:"var(--df)", fontSize:19, letterSpacing:1 }}>{w.emoji} {w.label}</div>
                    {isToday && <span style={{ fontSize:10, color:w.color, background:w.color+"22", padding:"2px 8px", borderRadius:20 }}>TODAY</span>}
                  </div>
                  {w.exercises.map(ex => (
                    <div key={ex.id} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0", borderBottom:"1px solid var(--border)" }}>
                      <span>{ex.name}</span>
                      <span style={{ color:"var(--muted)" }}>{ex.sets}×{ex.reps} · {getWeight(ex.id, ex.defaultWeight)}kg</span>
                    </div>
                  ))}
                  {w.exercises.length > 0 && (
                    <button className="btn-accent" style={{ marginTop:10, fontSize:15, padding:11 }}
                      onClick={() => setActiveWorkout({ key: k, ...w })}>
                      START THIS DAY
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>}

        {/* ── HISTORY ── */}
        {tab === "history" && <>
          <div className="phdr"><h1>HISTORY</h1><p>{history.length} sessions logged</p></div>
          <div className="scroll">
            {history.length === 0 && <p style={{ textAlign:"center", color:"var(--muted)", marginTop:40 }}>No sessions yet. Start your first workout! 💪</p>}
            {[...history].reverse().map((s, i) => {
              const w = WORKOUT_PROGRAM[s.dayKey];
              return (
                <div key={i} className="hist-card">
                  <div className="hist-top">
                    <div>
                      <div className="hist-day">{w?.emoji} {w?.label}</div>
                      <div className="hist-date">{new Date(s.date).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" })}</div>
                    </div>
                    <div className="hist-dur">{s.duration}min</div>
                  </div>
                  {s.exercises?.filter(e => !e.skipped).map((ex, j) => (
                    <div key={j} className="hist-row">
                      <span>{ex.name}</span>
                      <span style={{ color:"var(--muted)" }}>{ex.weight}kg · {ex.sets?.map(st => st.skipped ? "–" : (st.reps||"?")).join(" / ")}</span>
                    </div>
                  ))}
                  {s.note && <div className="hist-note">📝 {s.note}</div>}
                </div>
              );
            })}
          </div>
        </>}

        {/* ── TRAINER CHAT ── */}
        {tab === "chat" && (
          <TrainerChat history={history} weights={weights} user={user} />
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && <>
          <div className="phdr"><h1>SETTINGS</h1><p>{user.email}</p></div>
          <div className="scroll">
            <div className="card">
              <div className="ctitle" style={{ fontSize:14 }}>ACCOUNT</div>
              <div className="srow">
                <div><div className="slbl">{user.name}</div><div className="ssub">{user.email}</div></div>
                <button className="btn-ghost" onClick={() => { setUser(null); ls.set("gr_user", null); }}>Sign out</button>
              </div>
            </div>

            <div className="card">
              <div className="ctitle" style={{ fontSize:14 }}>GOOGLE INTEGRATION</div>
              <p style={{ fontSize:13, color:"var(--muted2)", marginBottom:12, lineHeight:1.6 }}>
                Automatically sync each workout to your Google Sheet and get daily calendar reminders.
              </p>
              <button className="btn-accent" style={{ fontSize:15, padding:12, marginBottom:8 }} onClick={handleConnectSheets}>
                {sheetId ? "✓ SHEETS CONNECTED" : "CONNECT GOOGLE SHEETS"}
              </button>
              <button className="btn-accent" style={{ fontSize:15, padding:12, background:"#1a2a3a", color:"#88aacc" }} onClick={handleCalendar}>
                SET UP CALENDAR REMINDERS
              </button>
              {sheetId && (
                <p style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>
                  Sheet ID: {sheetId.slice(0,18)}…
                </p>
              )}
            </div>

            <div className="card">
              <div className="ctitle" style={{ fontSize:14 }}>SCHEDULE</div>
              <div className="srow">
                <div><div className="slbl">Program start date</div><div className="ssub">Day 1 = Push day</div></div>
                <input type="date"
                  defaultValue={ls.get("gr_start","")?.slice(0,10)}
                  onChange={e => ls.set("gr_start", new Date(e.target.value).toISOString())}
                  style={{ background:"var(--s2)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text)", padding:"6px 8px", fontSize:13 }}
                />
              </div>
            </div>

            <div className="card">
              <div className="ctitle" style={{ fontSize:14 }}>DATA</div>
              <div className="srow">
                <div><div className="slbl">Clear all history</div><div className="ssub">Cannot be undone</div></div>
                <button style={{ fontSize:12, padding:"5px 11px", background:"#200d0d", border:"1px solid #4a1010", borderRadius:8, color:"#cc6666", cursor:"pointer" }}
                  onClick={() => { if (window.confirm("Delete all local history?")) { setHistory([]); setWeights({}); }}}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </>}

        {/* BOTTOM NAV */}
        <nav className="bnav">
          {[
            { id:"home",    label:"Home",    icon:<Ic.Home/> },
            { id:"workout", label:"Program", icon:<Ic.Dumbbell/> },
            { id:"history", label:"History", icon:<Ic.Clock/> },
            { id:"chat",    label:"Trainer", icon:<Ic.Chat/> },
            { id:"settings",label:"Settings",icon:<Ic.Cog/> },
          ].map(n => (
            <button key={n.id} className={`nbtn ${tab===n.id?"on":""}`} onClick={() => setTab(n.id)}>
              {n.icon}{n.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// WORKOUT SESSION
// ─────────────────────────────────────────────
function WorkoutSession({ workout, weights, setWeights, history, onFinish, onBack, startRest, getWeight }) {
  const startTime = useRef(Date.now());
  const [exStates, setExStates] = useState(() =>
    workout.exercises.map(ex => ({
      id: ex.id,
      name: ex.name,
      weight: getWeight(ex.id, ex.defaultWeight),
      skipped: false,
      sets: Array.from({ length: ex.sets }, () => ({ reps: "", skipped: false, done: false })),
    }))
  );
  const [note, setNote] = useState("");

  const updateSet = (ei, si, field, val) => {
    setExStates(s => s.map((ex, i) => i !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((st, j) => j !== si ? st : { ...st, [field]: val }),
    }));
  };

  const onRepsChange = (ei, si, val) => {
    const num = parseInt(val);
    updateSet(ei, si, "reps", val);
    updateSet(ei, si, "done", !isNaN(num) && num > 0);
  };

  const onRepsBlur = (ei, si) => {
    const ex = workout.exercises[ei];
    const isLastSet = si === ex.sets - 1;
    const reps = parseInt(exStates[ei].sets[si].reps);
    if (!isNaN(reps) && reps > 0) {
      startRest(isLastSet ? 15 : ex.rest);
    }
  };

  const toggleSetSkip = (ei, si) => {
    setExStates(s => s.map((ex, i) => i !== ei ? ex : {
      ...ex,
      sets: ex.sets.map((st, j) => j !== si ? st : { ...st, skipped: !st.skipped, done: false, reps: "" }),
    }));
  };

  const toggleExSkip = (ei) => {
    setExStates(s => s.map((ex, i) => i !== ei ? ex : { ...ex, skipped: !ex.skipped }));
  };

  const changeWeight = (ei, dir) => {
    setExStates(s => s.map((ex, i) => {
      if (i !== ei) return ex;
      const inc = ex.weight < 10 ? 0.5 : 1.25;
      const nw = Math.max(0, Math.round((ex.weight + dir * inc) * 100) / 100);
      setWeights(w => ({ ...w, [ex.id]: nw }));
      return { ...ex, weight: nw };
    }));
  };

  const handleFinish = () => {
    const duration = Math.round((Date.now() - startTime.current) / 60000);
    onFinish({ date: new Date().toISOString(), dayKey: workout.key, duration, note, exercises: exStates });
  };

  const allDone = exStates.every(ex =>
    ex.skipped || ex.sets.every(st => st.skipped || st.done)
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100svh" }}>
      <div className="w-header">
        <button className="back-btn" onClick={onBack}><Ic.Back/></button>
        <div>
          <div style={{ fontFamily:"var(--df)", fontSize:21, letterSpacing:1.5 }}>{workout.emoji} {workout.label}</div>
          <div style={{ fontSize:12, color:"var(--muted)" }}>
            {exStates.filter(e => !e.skipped).length} exercises · {workout.exercises.reduce((a,e) => a + e.sets, 0)} sets
          </div>
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", paddingBottom:90 }}>
        {exStates.map((exState, ei) => {
          const ex = workout.exercises[ei];
          const exHist = history.flatMap(h => h.exercises?.filter(e => e.id === ex.id) ?? []);
          const prog = getProgression(exHist, ex.reps, exState.weight);
          const allSetsDone = exState.sets.every(st => st.skipped || st.done);

          return (
            <div key={ex.id}>
              {prog && !exState.skipped && (
                <div className={`ai-banner ${prog.type === "increase" ? "good" : ""}`}>
                  {prog.type === "increase"
                    ? `🔥 You crushed this 2 sessions in a row! Try ${(exState.weight + prog.amount).toFixed(2)}kg today (+${prog.amount}kg)`
                    : `💡 You struggled last session — nail the reps at ${exState.weight}kg before going up`}
                </div>
              )}

              <div className={`ex-card ${exState.skipped ? "ex-skip" : allSetsDone ? "ex-done" : ""}`}>
                <div className="ex-chead">
                  <div>
                    <div className="ex-cname">{ex.name}</div>
                    <div className="ex-cmeta">{ex.sets} sets × {ex.reps} reps · {ex.rest}s rest</div>
                  </div>
                  <button className="btn-ghost" onClick={() => toggleExSkip(ei)}>
                    {exState.skipped ? "Restore" : "Skip"}
                  </button>
                </div>

                {!exState.skipped && <>
                  <div className="weight-row">
                    <div className="w-btn" onClick={() => changeWeight(ei, -1)}>−</div>
                    <div>
                      <div className="w-num">{exState.weight}kg</div>
                      <div className="w-lbl">WEIGHT</div>
                    </div>
                    <div className="w-btn" onClick={() => changeWeight(ei, 1)}>+</div>
                  </div>

                  <div className="sets-row">
                    {exState.sets.map((s, si) => (
                      <div key={si} className={`set-box ${s.done ? "set-done" : ""} ${s.skipped ? "set-skip" : ""}`}>
                        <div className="set-box-top">
                          <span className="set-num">Set {si + 1}</span>
                          <div className="set-done-ring"><Ic.Check /></div>
                          <div className="set-x" onClick={() => toggleSetSkip(ei, si)} title="Skip this set">✕</div>
                        </div>
                        <div className="set-target">target: <span>{ex.reps}</span></div>
                        <input
                          className="set-input"
                          type="number"
                          placeholder={String(ex.reps)}
                          value={s.reps}
                          disabled={s.skipped}
                          onChange={e => onRepsChange(ei, si, e.target.value)}
                          onBlur={() => onRepsBlur(ei, si)}
                        />
                      </div>
                    ))}
                  </div>
                </>}
              </div>
            </div>
          );
        })}

        <div className="note-wrap">
          <div className="note-lbl">📝 Session note (optional)</div>
          <textarea className="note-ta" placeholder="Feeling tired today, reduced weight on bench…" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <button className="finish-btn" onClick={handleFinish}>
          {allDone ? "✓ FINISH WORKOUT" : "FINISH WORKOUT (EARLY)"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TRAINER CHAT — calls /api/chat (Gemini)
// ─────────────────────────────────────────────
function TrainerChat({ history, weights, user }) {
  const [msgs, setMsgs] = useState([{
    role: "ai",
    text: `Hey ${user?.name?.split(" ")[0] ?? "there"}! I'm your personal trainer. I know all your workout data. Ask me anything — about your progress, what weight to use, why leg day matters… 💪`,
    time: now(),
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function now() { return new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); }

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMsgs(m => [...m, { role:"user", text, time: now() }]);
    setLoading(true);

    const recentHistory = history.slice(-15).map(s => ({
      date: s.date?.slice(0,10),
      day: s.dayKey,
      duration: s.duration,
      note: s.note,
      exercises: s.exercises?.map(e => ({
        name: e.name,
        weight: e.weight,
        sets: e.sets?.map(st => st.skipped ? "skipped" : (st.reps || "?")),
      })),
    }));

    const systemPrompt = `You are a personal gym trainer AI. Be direct, motivating, and practical — like a real coach, not a chatbot.

The user's workout program (Push → Pull → Legs → Rest → Upper → Lower → Rest):
- Push: Bench Press 3×12, Shrugs 3×15, Lateral Raises 3×15, Dumbbell Fly 3×15, Skullcrushers 3×15
- Pull: Pull Ups 3×12, Barbell Row 3×12, Lat Pullover 3×15, Reverse Fly 3×15, EZ Bar Curls 3×15
- Legs: Squat 3×10, Romanian Deadlift 3×15, Calf Raises 2×15, Crunches 2×15
- Upper: Bench Press 3×8, Barbell Row 2×8, Lateral Raises 2×10, Pull Ups 2×8, Fly 2×10, Preacher Curls 2×10, Skullcrushers 2×10
- Lower: Squat 3×8, Romanian Deadlift 3×10, Calf Raises 2×10, Crunches 3×10

Recent sessions (last 15): ${JSON.stringify(recentHistory)}
Current working weights: ${JSON.stringify(weights)}

Rules:
- Keep responses concise (3–6 sentences usually)
- If you spot patterns (like skipping legs), call it out with humor
- Give specific weight/rep recommendations when relevant
- Don't say "Great question!" or use filler phrases
- You can see when sets were skipped or notes were left`;

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          messages: [...msgs.slice(1), { role:"user", text }],
        }),
      });
      const d = await r.json();
      setMsgs(m => [...m, { role:"ai", text: d.reply ?? "Sorry, couldn't respond.", time: now() }]);
    } catch {
      setMsgs(m => [...m, { role:"ai", text: "Connection error — try again!", time: now() }]);
    }
    setLoading(false);
  };

  return (
    <div className="chat-wrap">
      <div className="phdr"><h1>TRAINER</h1><p>Powered by Gemini — free &amp; private</p></div>
      <div className="chat-msgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">{m.text}</div>
            <div className="msg-time">{m.time}</div>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="bubble"><div className="typing"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div className="chat-bar">
        <input className="chat-in" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask your trainer…" />
        <button className="send-btn" onClick={send}><Ic.Send/></button>
      </div>
    </div>
  );
}
