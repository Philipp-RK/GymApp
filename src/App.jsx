import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_PROGRAM = [
  { id:"push",  label:"Push Day",  shortLabel:"Push",  color:"#FF6B35", isRest:false, exercises:[
    { id:"bench",   name:"Bench Press",        sets:3, reps:12, rest:180, weight:57.5 },
    { id:"shrugs",  name:"Shrugs",             sets:3, reps:15, rest:120, weight:15 },
    { id:"lateral", name:"Lateral Raises",     sets:3, reps:15, rest:120, weight:10 },
    { id:"fly",     name:"Dumbbell Fly",        sets:3, reps:15, rest:120, weight:10 },
    { id:"skull",   name:"Skullcrushers",       sets:3, reps:15, rest:120, weight:20 },
  ]},
  { id:"pull",  label:"Pull Day",  shortLabel:"Pull",  color:"#4ECDC4", isRest:false, exercises:[
    { id:"pullup",   name:"Pull Ups",           sets:3, reps:12, rest:180, weight:0 },
    { id:"bbrow",    name:"Barbell Row",         sets:3, reps:12, rest:180, weight:37.5 },
    { id:"pullover", name:"Lat Pullover",        sets:3, reps:15, rest:120, weight:15 },
    { id:"revfly",   name:"Reverse Fly",         sets:3, reps:15, rest:120, weight:6 },
    { id:"ezcurl",   name:"EZ Bar Curls",        sets:3, reps:15, rest:120, weight:15 },
  ]},
  { id:"legs",  label:"Leg Day",   shortLabel:"Legs",  color:"#A8E6CF", isRest:false, exercises:[
    { id:"squat",  name:"Squat",                 sets:3, reps:10, rest:180, weight:55 },
    { id:"rdl",    name:"Romanian Deadlift",      sets:3, reps:15, rest:120, weight:35 },
    { id:"calf",   name:"One Leg Calf Raises",    sets:2, reps:15, rest:30,  weight:0 },
    { id:"crunch", name:"Crunches",               sets:2, reps:15, rest:30,  weight:0 },
  ]},
  { id:"rest1", label:"Rest Day",  shortLabel:"Rest",  color:"#444", isRest:true, exercises:[] },
  { id:"upper", label:"Upper Day", shortLabel:"Upper", color:"#C77DFF", isRest:false, exercises:[
    { id:"bench_u",   name:"Bench Press",        sets:3, reps:8,  rest:180, weight:65 },
    { id:"bbrow_u",   name:"Barbell Row",         sets:2, reps:8,  rest:180, weight:45 },
    { id:"lateral_u", name:"Lateral Raises",      sets:2, reps:10, rest:30,  weight:10 },
    { id:"pullup_u",  name:"Pull Ups",            sets:2, reps:8,  rest:60,  weight:0 },
    { id:"fly_u",     name:"Dumbbell Fly",         sets:2, reps:10, rest:120, weight:10 },
    { id:"preacher",  name:"Preacher Curls",       sets:2, reps:10, rest:30,  weight:20 },
    { id:"skull_u",   name:"Skullcrushers",        sets:2, reps:10, rest:30,  weight:25 },
  ]},
  { id:"lower", label:"Lower Day", shortLabel:"Lower", color:"#FFD166", isRest:false, exercises:[
    { id:"squat_l",  name:"Squat",               sets:3, reps:8,  rest:180, weight:60 },
    { id:"rdl_l",    name:"Romanian Deadlift",    sets:3, reps:10, rest:120, weight:45 },
    { id:"calf_l",   name:"One Leg Calf Raises",  sets:2, reps:10, rest:30,  weight:15 },
    { id:"crunch_l", name:"Crunches",             sets:3, reps:10, rest:30,  weight:0 },
  ]},
  { id:"rest2", label:"Rest Day",  shortLabel:"Rest",  color:"#444", isRest:true, exercises:[] },
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "YOUR_GOOGLE_CLIENT_ID";
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/userinfo.email","https://www.googleapis.com/auth/userinfo.profile","https://www.googleapis.com/auth/spreadsheets","https://www.googleapis.com/auth/calendar.events"].join(" ");

function getProgression(exHistory, targetReps, currentWeight) {
  if (!exHistory || exHistory.length < 2) return null;
  const last2 = exHistory.slice(-2);
  const allHit = last2.every(s => s.sets?.every(st => st.skipped || parseInt(st.reps) >= targetReps));
  if (allHit) { const inc = currentWeight < 10 ? 0.5 : currentWeight < 30 ? 1.25 : 2.5; return { type:"increase", amount:inc }; }
  const bigMiss = last2[last2.length-1].sets?.some(st => !st.skipped && parseInt(st.reps) < targetReps - 3);
  if (bigMiss) return { type:"hold" };
  return null;
}

const ls = {
  get: (k,fb) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):fb; } catch { return fb; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
};
function uid() { return Math.random().toString(36).slice(2,9); }

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--bg:#0a0a0a;--s1:#141414;--s2:#1c1c1c;--s3:#242424;--border:#282828;--border2:#333;--text:#efefef;--muted:#555;--muted2:#888;--accent:#FF6B35;--green:#4CAF50;--gbg:#0d200d;--gborder:#1a3a1a;--r:14px;--df:'Bebas Neue',sans-serif;--db:'DM Sans',sans-serif;}
body{background:var(--bg);color:var(--text);font-family:var(--db);-webkit-tap-highlight-color:transparent;}
input[type=number]{-moz-appearance:textfield;}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
input[type=date],input[type=text],input[type=number]{color-scheme:dark;}
.app{max-width:430px;margin:0 auto;min-height:100svh;display:flex;flex-direction:column;}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:var(--s1);border-top:1px solid var(--border);display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom,6px);}
.nbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px 6px;background:none;border:none;cursor:pointer;color:var(--muted);font-family:var(--db);font-size:10px;font-weight:500;letter-spacing:.4px;text-transform:uppercase;transition:color .15s;}
.nbtn.on{color:var(--accent);}
.nbtn svg{width:21px;height:21px;}
.phdr{padding:50px 18px 14px;background:var(--s1);border-bottom:1px solid var(--border);}
.phdr h1{font-family:var(--df);font-size:30px;letter-spacing:2px;}
.phdr p{color:var(--muted2);font-size:13px;margin-top:2px;}
.scroll{flex:1;overflow-y:auto;padding:14px 14px 96px;-webkit-overflow-scrolling:touch;}
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px;}
.ctitle{font-family:var(--df);font-size:17px;letter-spacing:1px;margin-bottom:10px;}
.btn-accent{width:100%;padding:15px;background:var(--accent);color:#fff;border:none;border-radius:var(--r);font-family:var(--df);font-size:19px;letter-spacing:2px;cursor:pointer;transition:opacity .15s,transform .1s;}
.btn-accent:active{transform:scale(.98);opacity:.88;}
.btn-ghost{background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:5px 12px;font-size:11px;color:var(--muted2);cursor:pointer;font-family:var(--db);}
.btn-danger{background:#200d0d;border:1px solid #4a1010;border-radius:8px;padding:5px 12px;font-size:11px;color:#cc6666;cursor:pointer;font-family:var(--db);}
.btn-icon{background:none;border:none;cursor:pointer;color:var(--muted2);padding:4px;display:flex;align-items:center;}
.day-badge{display:inline-block;font-family:var(--df);font-size:12px;letter-spacing:2px;padding:3px 10px;border-radius:20px;margin-bottom:6px;}
.day-label{font-family:var(--df);font-size:34px;letter-spacing:2px;}
.ex-preview{display:flex;flex-direction:column;gap:5px;margin:10px 0;}
.ex-row{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--s2);border-radius:8px;font-size:13px;}
.prog-pill{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--gbg);color:#88cc88;border:1px solid var(--gborder);}
.week-grid{display:grid;gap:4px;margin:10px 0 6px;}
.wdot{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;background:var(--s2);color:var(--muted);}
.wdot.done{background:#0d200d;color:#88cc88;}
.wdot.today{outline:1.5px solid var(--accent);outline-offset:1px;}
.wdot.rdot{font-size:18px;color:var(--border2);}
.wdot.rdot.done{background:var(--s2);color:var(--muted);}
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;}
.stat-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:12px;}
.stat-lbl{font-size:10px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px;}
.stat-num{font-family:var(--df);font-size:28px;letter-spacing:1px;}
.streak-chip{display:flex;align-items:center;gap:5px;font-family:var(--df);font-size:14px;letter-spacing:1px;padding:5px 11px;background:var(--s2);border-radius:20px;border:1px solid var(--border);}
.w-header{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--s1);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;}
.back-btn{width:36px;height:36px;background:var(--s2);border:1px solid var(--border);border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);flex-shrink:0;}
.ex-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);margin:0 14px 12px;overflow:hidden;transition:border-color .2s;}
.ex-card.ex-done{border-color:var(--gborder);}
.ex-card.ex-skip{opacity:.4;}
.ex-chead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);}
.ex-cname{font-weight:600;font-size:15px;}
.ex-cmeta{color:var(--muted);font-size:12px;margin-top:2px;}
.ai-banner{margin:0 14px 10px;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.5;border-left:2.5px solid var(--accent);background:#1a1008;color:#ffcc88;}
.ai-banner.good{border-color:var(--green);background:var(--gbg);color:#88cc88;}
.weight-row{display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 14px;background:var(--s2);border-bottom:1px solid var(--border);}
.w-btn{width:38px;height:38px;border-radius:50%;background:var(--s3);border:1px solid var(--border2);color:var(--text);font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;}
.w-num{font-family:var(--df);font-size:28px;letter-spacing:.5px;min-width:85px;text-align:center;}
.w-lbl{font-size:11px;color:var(--muted);letter-spacing:1px;text-align:center;margin-top:-3px;}
.sets-row{display:flex;gap:8px;padding:12px 14px;}
.set-box{flex:1;border:1.5px solid var(--border);border-radius:12px;background:var(--s2);overflow:hidden;transition:border-color .15s,background .15s;position:relative;}
.set-box.set-done{border-color:var(--gborder);background:var(--gbg);}
.set-box.set-skip{opacity:.35;pointer-events:none;}
.set-box-top{display:flex;justify-content:space-between;align-items:center;padding:7px 8px 3px;}
.set-num{font-size:10px;color:var(--muted);font-weight:600;letter-spacing:.3px;text-transform:uppercase;}
.set-done-ring{width:16px;height:16px;border-radius:50%;background:var(--gbg);border:1.5px solid var(--gborder);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;}
.set-box.set-done .set-done-ring{opacity:1;}
.set-x{width:18px;height:18px;border-radius:4px;background:var(--s3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);cursor:pointer;}
.set-target{font-size:11px;color:var(--muted);text-align:center;padding:0 6px 3px;}
.set-target span{color:var(--muted2);}
.set-input{width:calc(100% - 12px);background:var(--s3);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);font-size:26px;font-weight:700;text-align:center;padding:7px 4px 8px;outline:none;font-family:var(--db);display:block;margin:4px 6px 8px;transition:border-color .15s,background .15s,color .15s;}
.set-box.set-done .set-input{border-color:var(--gborder);background:#0a1a0a;color:#88cc88;}
.rest-overlay{position:fixed;inset:0;background:rgba(0,0,0,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;}
.rest-lbl{font-family:var(--df);font-size:16px;letter-spacing:4px;color:var(--muted);margin-bottom:6px;}
.rest-num{font-family:var(--df);font-size:100px;letter-spacing:3px;line-height:1;}
.rest-skip{margin-top:28px;padding:13px 36px;background:var(--s2);border:1px solid var(--border);border-radius:var(--r);color:var(--muted2);font-family:var(--df);font-size:15px;letter-spacing:1px;cursor:pointer;}
.note-wrap{padding:0 14px 12px;}
.note-lbl{font-size:12px;color:var(--muted);margin-bottom:5px;}
.note-ta{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:var(--db);font-size:14px;padding:10px 12px;resize:none;min-height:64px;outline:none;}
.finish-btn{display:block;width:calc(100% - 28px);margin:0 14px 14px;padding:15px;background:var(--gbg);border:1px solid var(--gborder);border-radius:var(--r);color:#88cc88;font-family:var(--df);font-size:19px;letter-spacing:2px;cursor:pointer;}
.hist-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:13px;margin-bottom:9px;}
.hist-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border);}
.hist-row:last-of-type{border-bottom:none;}
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
.send-btn{width:42px;height:42px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.typing{display:flex;gap:5px;align-items:center;padding:2px 0;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--muted2);animation:blink 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes blink{0%,80%,100%{opacity:.2;}40%{opacity:1;}}
.srow{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid var(--border);}
.srow:last-child{border-bottom:none;}
.slbl{font-size:15px;}
.ssub{font-size:12px;color:var(--muted);margin-top:2px;}
.tog{width:44px;height:24px;border-radius:12px;background:var(--border2);position:relative;cursor:pointer;transition:background .2s;border:none;flex-shrink:0;}
.tog.on{background:var(--accent);}
.tog::after{content:'';position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;}
.tog.on::after{transform:translateX(20px);}
.prog-day-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;overflow:hidden;}
.prog-day-header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border);}
.prog-day-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
.prog-day-name{font-weight:600;font-size:15px;flex:1;}
.prog-day-actions{display:flex;gap:4px;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:var(--s1);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:430px;max-height:90svh;overflow-y:auto;}
.modal-title{font-family:var(--df);font-size:22px;letter-spacing:1px;margin-bottom:16px;}
.form-row{margin-bottom:12px;}
.form-lbl{font-size:12px;color:var(--muted);margin-bottom:5px;}
.form-input{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:var(--db);font-size:15px;padding:10px 12px;outline:none;}
.mini-input{background:var(--s2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--db);font-size:13px;padding:4px 8px;width:100%;text-align:center;}
.login{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:var(--bg);}
.login-logo{font-family:var(--df);font-size:64px;letter-spacing:5px;color:var(--accent);}
.login-tagline{color:var(--muted2);font-size:15px;margin:6px 0 48px;line-height:1.7;}
.google-btn{display:flex;align-items:center;gap:12px;padding:13px 26px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--db);font-size:16px;font-weight:500;cursor:pointer;margin-bottom:14px;transition:border-color .15s;}
.google-btn:hover{border-color:var(--accent);}
.demo-lnk{background:none;border:none;color:var(--muted2);font-family:var(--db);font-size:13px;cursor:pointer;text-decoration:underline;margin-top:4px;}
.login-note{color:var(--muted);font-size:12px;margin-top:36px;line-height:1.7;max-width:280px;}
`;

const Ic = {
  Home:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  Dumbbell: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  Clock:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  Chat:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Cog:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Send:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Back:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  Check:    ()=><svg viewBox="0 0 10 8" fill="none" stroke="#88cc88" strokeWidth="2.5"><polyline points="1,4 4,7 9,1"/></svg>,
  Edit:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Up:       ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M18 15l-6-6-6 6"/></svg>,
  Down:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M6 9l6 6 6-6"/></svg>,
  Google:   ()=><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
};

export default function App() {
  const [user,        setUser]        = useState(()=>ls.get("gr_user",null));
  const [tab,         setTab]         = useState("home");
  const [history,     setHistory]     = useState(()=>ls.get("gr_history",[]));
  const [program,     setProgram]     = useState(()=>ls.get("gr_program",DEFAULT_PROGRAM));
  const [sheetId,     setSheetId]     = useState(()=>ls.get("gr_sheetId",null));
  const [restEnabled, setRestEnabled] = useState(()=>ls.get("gr_rest",true));
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [restTimer,     setRestTimer]     = useState(null);
  const [editingDay,    setEditingDay]    = useState(null);
  const restRef = useRef(null);

  useEffect(()=>{ls.set("gr_history",history);},[history]);
  useEffect(()=>{ls.set("gr_program",program);},[program]);
  useEffect(()=>{ls.set("gr_rest",restEnabled);},[restEnabled]);
  useEffect(()=>{if(user)ls.set("gr_user",user);},[user]);

  const startDate = ls.get("gr_start",null);
  const todayIdx  = startDate ? Math.floor((Date.now()-new Date(startDate).getTime())/86400000)%program.length : 0;
  const todayDay  = program[todayIdx];

  const startRest = useCallback((secs)=>{
    if(!restEnabled) return;
    setRestTimer(secs);
    clearInterval(restRef.current);
    restRef.current = setInterval(()=>{
      setRestTimer(t=>{ if(t<=1){clearInterval(restRef.current);return null;} return t-1; });
    },1000);
  },[restEnabled]);

  const handleFinish = useCallback(async(session)=>{
    setHistory(h=>[...h,session]);
    setProgram(p=>p.map(day=>({...day,exercises:day.exercises.map(ex=>{
      const m=session.exercises?.find(e=>e.id===ex.id);
      return m&&!m.skipped?{...ex,weight:m.weight}:ex;
    })})));
    setActiveWorkout(null);
    if(sheetId&&user?.accessToken){
      try{ await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"append",accessToken:user.accessToken,spreadsheetId:sheetId,session})}); }catch{}
    }
  },[sheetId,user]);

  const updateDay = (id,ch)=>setProgram(p=>p.map(d=>d.id===id?{...d,...ch}:d));
  const updateEx  = (did,eid,ch)=>setProgram(p=>p.map(d=>d.id!==did?d:{...d,exercises:d.exercises.map(e=>e.id===eid?{...e,...ch}:e)}));
  const addEx     = (did)=>setProgram(p=>p.map(d=>d.id!==did?d:{...d,exercises:[...d.exercises,{id:uid(),name:"New Exercise",sets:3,reps:10,rest:120,weight:20}]}));
  const removeEx  = (did,eid)=>setProgram(p=>p.map(d=>d.id!==did?d:{...d,exercises:d.exercises.filter(e=>e.id!==eid)}));
  const addDay    = ()=>setProgram(p=>[...p,{id:uid(),label:"New Day",shortLabel:"New",color:"#888",isRest:false,exercises:[]}]);
  const removeDay = (id)=>setProgram(p=>p.map(d=>d.id!==id?d:{...d,isRest:true,exercises:[],label:"Rest Day",shortLabel:"Rest"}));
  const moveDay   = (i,dir)=>{ const a=[...program]; const j=i+dir; if(j<0||j>=a.length)return; [a[i],a[j]]=[a[j],a[i]]; setProgram(a); };

  const handleDemo  = ()=>{ if(!ls.get("gr_start",null))ls.set("gr_start",new Date().toISOString()); setUser({name:"Demo User",email:"demo@example.com",demo:true}); };
  const handleLogin = ()=>{ if(GOOGLE_CLIENT_ID==="YOUR_GOOGLE_CLIENT_ID"){handleDemo();return;} const p=new URLSearchParams({client_id:GOOGLE_CLIENT_ID,redirect_uri:`${window.location.origin}/auth/callback`,response_type:"token",scope:GOOGLE_SCOPES,prompt:"select_account"}); window.location.href=`https://accounts.google.com/o/oauth2/v2/auth?${p}`; };
  const handleConnectSheets = async()=>{ if(!user?.accessToken)return alert("Sign in with Google first."); try{ const r=await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",accessToken:user.accessToken})}); const d=await r.json(); if(d.spreadsheetId){setSheetId(d.spreadsheetId);ls.set("gr_sheetId",d.spreadsheetId);alert("✅ Google Sheet created!");} }catch{alert("Error.");} };
  const handleCalendar = async()=>{ if(!user?.accessToken)return alert("Sign in with Google first."); const r=await fetch("/api/calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:user.accessToken,startDate:ls.get("gr_start",new Date().toISOString())})}); const d=await r.json(); if(d.ok)alert(`✅ ${d.eventsCreated} reminders added!`); };

  const totalSessions = history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-todayIdx); weekStart.setHours(0,0,0,0);
  const thisWeek = history.filter(h=>new Date(h.date)>=weekStart&&!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const streak = (()=>{ let s=0; for(let i=history.length-1;i>=0;i--){ if(!program.find(d=>d.id===history[i].dayKey)?.isRest)s++; else break; } return s; })();

  if(!user) return(<><style>{CSS}</style><div className="login"><div className="login-logo">GRIND</div><p className="login-tagline">Your free AI personal trainer.<br/>Track. Progress. Never skip leg day.</p><button className="google-btn" onClick={handleLogin}><Ic.Google/> Continue with Google</button><button className="demo-lnk" onClick={handleDemo}>Try without signing in</button><p className="login-note">Signing in creates a personal Google Sheet and adds calendar reminders — all free.</p></div></>);

  if(activeWorkout) return(<><style>{CSS}</style><div className="app"><WorkoutSession workout={activeWorkout} history={history} onFinish={handleFinish} onBack={()=>setActiveWorkout(null)} startRest={startRest} restEnabled={restEnabled}/>{restTimer!==null&&(<div className="rest-overlay"><div className="rest-lbl">REST</div><div className="rest-num" style={{color:restTimer<=10?"var(--accent)":"var(--text)"}}>{restTimer}</div><button className="rest-skip" onClick={()=>{clearInterval(restRef.current);setRestTimer(null);}}>SKIP REST</button></div>)}</div></>);

  return(<><style>{CSS}</style><div className="app">

    {tab==="home"&&<><div className="phdr"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><h1>GRIND</h1><p>Hey {user.name?.split(" ")[0]} 👋</p></div><div className="streak-chip">🔥 {streak}</div></div></div><div className="scroll">
      <div className="stats-row"><div className="stat-card"><div className="stat-lbl">Total</div><div className="stat-num">{totalSessions}</div></div><div className="stat-card"><div className="stat-lbl">This week</div><div className="stat-num">{thisWeek}</div></div><div className="stat-card"><div className="stat-lbl">Streak</div><div className="stat-num">{streak}🔥</div></div></div>
      <div className="card" style={{borderColor:todayDay.color+"55"}}>
        <div className="day-badge" style={{background:todayDay.color+"22",color:todayDay.color}}>TODAY</div>
        <div className="day-label">{todayDay.label}</div>
        {!todayDay.isRest?<><div className="ex-preview">{todayDay.exercises.map(ex=>{ const eh=history.flatMap(h=>h.exercises?.filter(e=>e.id===ex.id)??[]); const pg=getProgression(eh,ex.reps,ex.weight); return(<div key={ex.id} className="ex-row"><div><div style={{fontWeight:500}}>{ex.name}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{ex.sets}×{ex.reps} · {ex.weight}kg</div></div>{pg?.type==="increase"&&<span className="prog-pill">↑ +{pg.amount}kg</span>}</div>); })}</div><button className="btn-accent" onClick={()=>setActiveWorkout(todayDay)}>START WORKOUT</button></>:<p style={{color:"var(--muted2)",marginTop:8,fontSize:14}}>Recovery is part of the process. Rest up 🛌</p>}
      </div>
      <div className="card"><div className="ctitle">THIS WEEK</div><div className="week-grid" style={{gridTemplateColumns:`repeat(${program.length},1fr)`}}>{program.map((day,i)=>{ const isT=i===todayIdx; const done=history.some(h=>h.dayKey===day.id&&new Date(h.date)>=weekStart); return(<div key={day.id} className={`wdot ${day.isRest?"rdot":""} ${done?"done":""} ${isT?"today":""}`} title={day.label} style={!day.isRest?{color:done?undefined:day.color+"cc"}:{}}>{day.isRest?"·":day.shortLabel?.[0]??"?"}</div>); })}</div></div>
    </div></>}

    {tab==="workout"&&<><div className="phdr"><h1>PROGRAM</h1></div><div className="scroll">
      {program.map((day,i)=>{
        const isT=i===todayIdx;
        return(<div key={day.id} className="prog-day-card" style={{borderColor:isT?day.color:undefined}}>
          <div className="prog-day-header">
            <div className="prog-day-dot" style={{background:day.color}}/>
            <div className="prog-day-name">{day.label}{isT&&<span style={{fontSize:10,color:day.color,marginLeft:8,background:day.color+"22",padding:"2px 7px",borderRadius:20}}>TODAY</span>}</div>
            <div className="prog-day-actions">
              <button className="btn-icon" onClick={()=>moveDay(i,-1)}><Ic.Up/></button>
              <button className="btn-icon" onClick={()=>moveDay(i,1)}><Ic.Down/></button>
              <button className="btn-icon" onClick={()=>setEditingDay({...day})}><Ic.Edit/></button>
              {!day.isRest&&<button className="btn-icon" style={{color:"#cc6666"}} onClick={()=>{if(window.confirm("Convert to rest day?"))removeDay(day.id);}}><Ic.Trash/></button>}
            </div>
          </div>
          {day.exercises.map(ex=>(<div key={ex.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 14px",borderBottom:"1px solid var(--border)"}}><span>{ex.name}</span><span style={{color:"var(--muted)"}}>{ex.sets}×{ex.reps} · {ex.weight}kg</span></div>))}
          {!day.isRest&&<button className="btn-accent" style={{margin:10,width:"calc(100% - 20px)",fontSize:15,padding:10}} onClick={()=>setActiveWorkout(day)}>START</button>}
        </div>);
      })}
      <button className="btn-accent" style={{background:"var(--s2)",color:"var(--muted2)",border:"1px solid var(--border)"}} onClick={addDay}>+ ADD DAY</button>
    </div></>}

    {tab==="history"&&<><div className="phdr"><h1>HISTORY</h1><p>{totalSessions} sessions</p></div><div className="scroll">
      {history.length===0&&<p style={{textAlign:"center",color:"var(--muted)",marginTop:40}}>No sessions yet 💪</p>}
      {[...history].reverse().map((s,i)=>{ const day=program.find(d=>d.id===s.dayKey); return(<div key={i} className="hist-card"><div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div><div style={{fontWeight:600,color:day?.color}}>{day?.label??s.dayKey}</div><div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{new Date(s.date).toLocaleDateString("de-DE",{weekday:"short",day:"numeric",month:"short"})} · {s.duration}min</div></div></div>{s.exercises?.filter(e=>!e.skipped).map((ex,j)=>(<div key={j} className="hist-row"><span>{ex.name}</span><span style={{color:"var(--muted)"}}>{ex.weight}kg · {ex.sets?.map(st=>st.skipped?"–":(st.reps||"?")).join(" / ")}</span></div>))}{s.note&&<div style={{marginTop:7,fontSize:12,color:"var(--muted2)",fontStyle:"italic"}}>📝 {s.note}</div>}</div>); })}
    </div></>}

    {tab==="chat"&&<TrainerChat history={history} program={program} user={user}/>}

    {tab==="settings"&&<><div className="phdr"><h1>SETTINGS</h1><p>{user.email}</p></div><div className="scroll">
      <div className="card"><div className="ctitle" style={{fontSize:14}}>ACCOUNT</div><div className="srow"><div><div className="slbl">{user.name}</div><div className="ssub">{user.email}</div></div><button className="btn-ghost" onClick={()=>{setUser(null);ls.set("gr_user",null);}}>Sign out</button></div></div>
      <div className="card"><div className="ctitle" style={{fontSize:14}}>GOOGLE INTEGRATION</div><p style={{fontSize:13,color:"var(--muted2)",marginBottom:12,lineHeight:1.6}}>Sync workouts to Google Sheets and get daily calendar reminders.</p><button className="btn-accent" style={{fontSize:15,padding:12,marginBottom:8}} onClick={handleConnectSheets}>{sheetId?"✓ SHEETS CONNECTED":"CONNECT GOOGLE SHEETS"}</button><button className="btn-accent" style={{fontSize:15,padding:12,background:"#1a2a3a",color:"#88aacc"}} onClick={handleCalendar}>SET UP CALENDAR REMINDERS</button></div>
      <div className="card"><div className="ctitle" style={{fontSize:14}}>WORKOUT</div>
        <div className="srow"><div><div className="slbl">Rest timer between sets</div><div className="ssub">Countdown after each set</div></div><button className={`tog ${restEnabled?"on":""}`} onClick={()=>setRestEnabled(v=>!v)}/></div>
        <div className="srow"><div><div className="slbl">Schedule start date</div><div className="ssub">First day of your cycle</div></div><input type="date" defaultValue={ls.get("gr_start","")?.slice(0,10)} onChange={e=>ls.set("gr_start",new Date(e.target.value).toISOString())} style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",padding:"6px 8px",fontSize:13}}/></div>
      </div>
      <div className="card"><div className="ctitle" style={{fontSize:14}}>DATA</div><div className="srow"><div><div className="slbl">Clear all history</div><div className="ssub">Cannot be undone</div></div><button className="btn-danger" onClick={()=>{if(window.confirm("Delete all history?"))setHistory([]);}}>Clear</button></div><div className="srow"><div><div className="slbl">Reset program</div></div><button className="btn-danger" onClick={()=>{if(window.confirm("Reset program?"))setProgram(DEFAULT_PROGRAM);}}>Reset</button></div></div>
    </div></>}

    <nav className="bnav">{[{id:"home",label:"Home",icon:<Ic.Home/>},{id:"workout",label:"Program",icon:<Ic.Dumbbell/>},{id:"history",label:"History",icon:<Ic.Clock/>},{id:"chat",label:"Trainer",icon:<Ic.Chat/>},{id:"settings",label:"Settings",icon:<Ic.Cog/>}].map(n=>(<button key={n.id} className={`nbtn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>{n.icon}{n.label}</button>))}</nav>

    {editingDay&&<DayEditor day={editingDay} onClose={()=>setEditingDay(null)} onSave={upd=>{updateDay(editingDay.id,upd);setEditingDay(null);}} onAddEx={()=>{addEx(editingDay.id);setEditingDay(d=>({...d,exercises:[...d.exercises,{id:"_new",name:"New Exercise",sets:3,reps:10,rest:120,weight:20}]})};}} onRemoveEx={eid=>{removeEx(editingDay.id,eid);setEditingDay(d=>({...d,exercises:d.exercises.filter(e=>e.id!==eid)}));}} onUpdateEx={(eid,ch)=>{updateEx(editingDay.id,eid,ch);setEditingDay(d=>({...d,exercises:d.exercises.map(e=>e.id===eid?{...e,...ch}:e)}));}}/>}
  </div></>);
}

function DayEditor({day,onClose,onSave,onAddEx,onRemoveEx,onUpdateEx}){
  const [label,setLabel]=useState(day.label);
  const [short,setShort]=useState(day.shortLabel);
  const [color,setColor]=useState(day.color);
  return(<div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="modal-title">EDIT DAY</div>
    <div className="form-row"><div className="form-lbl">Day name</div><input className="form-input" value={label} onChange={e=>setLabel(e.target.value)}/></div>
    <div className="form-row"><div className="form-lbl">Short label (week view dot)</div><input className="form-input" value={short} onChange={e=>setShort(e.target.value)} maxLength={6}/></div>
    <div className="form-row"><div className="form-lbl">Color</div><input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:48,height:36,border:"none",borderRadius:8,cursor:"pointer",background:"none"}}/></div>
    {!day.isRest&&<><div style={{fontFamily:"var(--df)",fontSize:15,letterSpacing:1,margin:"16px 0 8px"}}>EXERCISES</div>
      {day.exercises.map(ex=>(<div key={ex.id} style={{background:"var(--s2)",borderRadius:10,padding:12,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <input className="form-input" style={{fontSize:14,padding:"6px 10px"}} value={ex.name} onChange={e=>onUpdateEx(ex.id,{name:e.target.value})}/>
          <button className="btn-icon" style={{color:"#cc6666",marginLeft:8}} onClick={()=>onRemoveEx(ex.id)}><Ic.Trash/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          {[{l:"Sets",f:"sets",v:ex.sets},{l:"Reps",f:"reps",v:ex.reps},{l:"Weight",f:"weight",v:ex.weight},{l:"Rest (s)",f:"rest",v:ex.rest}].map(({l,f,v})=>(<div key={f}><div style={{fontSize:10,color:"var(--muted)",marginBottom:3}}>{l}</div><input type="number" className="mini-input" value={v} onChange={e=>onUpdateEx(ex.id,{[f]:parseFloat(e.target.value)||0})}/></div>))}
        </div>
      </div>))}
      <button style={{width:"100%",padding:10,background:"var(--s2)",border:"1px dashed var(--border2)",borderRadius:10,color:"var(--muted2)",cursor:"pointer",fontFamily:"var(--db)",fontSize:14,marginBottom:16}} onClick={onAddEx}>+ Add exercise</button>
    </>}
    <button className="btn-accent" onClick={()=>onSave({label,shortLabel:short,color})}>SAVE</button>
    <button style={{width:"100%",padding:12,background:"none",border:"none",color:"var(--muted2)",cursor:"pointer",fontFamily:"var(--db)",marginTop:8}} onClick={onClose}>Cancel</button>
  </div></div>);
}

function WorkoutSession({workout,history,onFinish,onBack,startRest,restEnabled}){
  const startTime=useRef(Date.now());
  const [exStates,setExStates]=useState(()=>workout.exercises.map(ex=>({id:ex.id,name:ex.name,weight:ex.weight,skipped:false,sets:Array.from({length:ex.sets},()=>({reps:"",skipped:false,done:false}))})));
  const [note,setNote]=useState("");
  const upd=(ei,si,ch)=>setExStates(s=>s.map((ex,i)=>i!==ei?ex:{...ex,sets:ex.sets.map((st,j)=>j!==si?st:{...st,...ch})}));
  const onRepsChange=(ei,si,val)=>{ const n=parseInt(val); upd(ei,si,{reps:val,done:!isNaN(n)&&n>0}); };
  const onRepsBlur=(ei,si)=>{ const ex=workout.exercises[ei]; const r=parseInt(exStates[ei].sets[si].reps); const isLastSet=si===ex.sets-1; const isLastEx=ei===workout.exercises.length-1; if(!isNaN(r)&&r>0&&restEnabled&&!(isLastSet&&isLastEx))startRest(ex.rest); };
  const toggleSetSkip=(ei,si)=>upd(ei,si,{skipped:!exStates[ei].sets[si].skipped,done:false,reps:""});
  const toggleExSkip=(ei)=>setExStates(s=>s.map((ex,i)=>i!==ei?ex:{...ex,skipped:!ex.skipped}));
  const changeWeight=(ei,dir)=>setExStates(s=>s.map((ex,i)=>{ if(i!==ei)return ex; const inc=ex.weight<10?0.5:1.25; return{...ex,weight:Math.max(0,Math.round((ex.weight+dir*inc)*100)/100)}; }));
  const allDone=exStates.every(ex=>ex.skipped||ex.sets.every(st=>st.skipped||st.done));
  const handleFinish=()=>{ const duration=Math.round((Date.now()-startTime.current)/60000); onFinish({date:new Date().toISOString(),dayKey:workout.id,duration,note,exercises:exStates}); };

  return(<div style={{display:"flex",flexDirection:"column",minHeight:"100svh"}}>
    <div className="w-header"><button className="back-btn" onClick={onBack}><Ic.Back/></button><div><div style={{fontFamily:"var(--df)",fontSize:21,letterSpacing:1.5}}>{workout.label}</div><div style={{fontSize:12,color:"var(--muted)"}}>{exStates.filter(e=>!e.skipped).length} exercises</div></div></div>
    <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
      {exStates.map((exState,ei)=>{ const ex=workout.exercises[ei]; const eh=history.flatMap(h=>h.exercises?.filter(e=>e.id===ex.id)??[]); const pg=getProgression(eh,ex.reps,exState.weight); const allSD=exState.sets.every(st=>st.skipped||st.done);
        return(<div key={ex.id}>
          {pg&&!exState.skipped&&<div className={`ai-banner ${pg.type==="increase"?"good":""}`}>{pg.type==="increase"?`🔥 2x in Folge geschafft! Versuch heute ${(exState.weight+pg.amount).toFixed(2)}kg (+${pg.amount}kg)`:`💡 Letztes Mal war es schwer — bleib bei ${exState.weight}kg`}</div>}
          <div className={`ex-card ${exState.skipped?"ex-skip":allSD?"ex-done":""}`}>
            <div className="ex-chead"><div><div className="ex-cname">{ex.name}</div><div className="ex-cmeta">{ex.sets} sets × {ex.reps} reps{restEnabled?` · ${ex.rest}s rest`:""}</div></div><button className="btn-ghost" onClick={()=>toggleExSkip(ei)}>{exState.skipped?"Restore":"Skip"}</button></div>
            {!exState.skipped&&<><div className="weight-row"><div className="w-btn" onClick={()=>changeWeight(ei,-1)}>−</div><div><div className="w-num">{exState.weight}kg</div><div className="w-lbl">WEIGHT</div></div><div className="w-btn" onClick={()=>changeWeight(ei,1)}>+</div></div>
            <div className="sets-row">{exState.sets.map((s,si)=>(<div key={si} className={`set-box ${s.done?"set-done":""} ${s.skipped?"set-skip":""}`}><div className="set-box-top"><span className="set-num">Set {si+1}</span><div className="set-done-ring"><Ic.Check/></div><div className="set-x" onClick={()=>toggleSetSkip(ei,si)}>✕</div></div><div className="set-target">target: <span>{ex.reps}</span></div><input className="set-input" type="number" placeholder={String(ex.reps)} value={s.reps} disabled={s.skipped} onChange={e=>onRepsChange(ei,si,e.target.value)} onBlur={()=>onRepsBlur(ei,si)}/></div>))}</div></>}
          </div>
        </div>);
      })}
      <div className="note-wrap"><div className="note-lbl">📝 Session note (optional)</div><textarea className="note-ta" placeholder="Heute etwas müde…" value={note} onChange={e=>setNote(e.target.value)}/></div>
      <button className="finish-btn" onClick={handleFinish}>{allDone?"✓ WORKOUT BEENDEN":"WORKOUT BEENDEN (FRÜH)"}</button>
    </div>
  </div>);
}

function TrainerChat({history,program,user}){
  const getName=()=>user?.name?.split(" ")[0]??"there";
  const [msgs,setMsgs]=useState([{role:"ai",text:`Hey ${getName()}! Ich bin dein persönlicher Trainer. Ich kenne all deine Workout-Daten. Frag mich alles — Fortschritt, Gewichte, oder warum du endlich Beine trainieren solltest… 💪`,time:nowT()}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  function nowT(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
  const send=async()=>{
    if(!input.trim()||loading)return;
    const text=input.trim(); setInput("");
    setMsgs(m=>[...m,{role:"user",text,time:nowT()}]); setLoading(true);
    const progSum=program.filter(d=>!d.isRest).map(d=>({name:d.label,exercises:d.exercises.map(e=>`${e.name} ${e.sets}×${e.reps} @ ${e.weight}kg`)}));
    const hist=history.slice(-15).map(s=>({date:s.date?.slice(0,10),day:s.dayKey,duration:s.duration,note:s.note,exercises:s.exercises?.map(e=>({name:e.name,weight:e.weight,sets:e.sets?.map(st=>st.skipped?"skip":(st.reps||"?"))}))}));
    const sys=`Du bist ein persönlicher Gym-Trainer. Sei direkt, motivierend, praktisch. Antworte auf Deutsch außer der Nutzer schreibt Englisch.\nProgramm: ${JSON.stringify(progSum)}\nLetzte 15 Sessions: ${JSON.stringify(hist)}\nRegeln: Kurze Antworten (3-5 Sätze), keine Füllphrasen, konkrete Empfehlungen, Humor wenn Beine übersprungen werden.`;
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemPrompt:sys,messages:[...msgs.slice(1),{role:"user",text}]})});
      const d=await r.json();
      setMsgs(m=>[...m,{role:"ai",text:d.reply??"Fehler — versuch nochmal.",time:nowT()}]);
    }catch{ setMsgs(m=>[...m,{role:"ai",text:"Verbindungsfehler!",time:nowT()}]); }
    setLoading(false);
  };
  return(<div className="chat-wrap">
    <div className="phdr"><h1>TRAINER</h1></div>
    <div className="chat-msgs">
      {msgs.map((m,i)=>(<div key={i} className={`msg ${m.role}`}><div className="bubble">{m.text}</div><div className="msg-time">{m.time}</div></div>))}
      {loading&&<div className="msg ai"><div className="bubble"><div className="typing"><div className="dot"/><div className="dot"/><div className="dot"/></div></div></div>}
      <div ref={bottomRef}/>
    </div>
    <div className="chat-bar"><input className="chat-in" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Frag deinen Trainer…"/><button className="send-btn" onClick={send}><Ic.Send/></button></div>
  </div>);
}
