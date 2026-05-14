import { useState, useEffect, useRef, useCallback } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";

function getSetLabel(sets, si) {
  const t = sets[si]?.setType ?? "normal";
  if (t === "warmup") return "W";
  if (t === "drop")   return "D";
  let n = 0;
  for (let i = 0; i <= si; i++) {
    if ((sets[i]?.setType ?? "normal") === "normal") n++;
  }
  return String(n);
}

function cycleSetType(current) {
  if (current === "normal") return "warmup";
  if (current === "warmup") return "drop";
  return "normal";
}

const DEFAULT_PROGRAM = [
  { id:"push", label:"Push Day", color:"#FF6B35", isRest:false, exercises:[
    { id:"bench",   name:"Bench Press",     sets:3, reps:12, rest:180, weight:57.5 },
    { id:"shrugs",  name:"Shrugs",          sets:3, reps:15, rest:120, weight:15 },
    { id:"lateral", name:"Lateral Raises",  sets:3, reps:15, rest:120, weight:10 },
    { id:"fly",     name:"Dumbbell Fly",    sets:3, reps:15, rest:120, weight:10 },
    { id:"skull",   name:"Skullcrushers",   sets:3, reps:15, rest:120, weight:20 },
  ]},
  { id:"pull", label:"Pull Day", color:"#4ECDC4", isRest:false, exercises:[
    { id:"pullup",   name:"Pull Ups",       sets:3, reps:12, rest:180, weight:0 },
    { id:"bbrow",    name:"Barbell Row",    sets:3, reps:12, rest:180, weight:37.5 },
    { id:"pullover", name:"Lat Pullover",   sets:3, reps:15, rest:120, weight:15 },
    { id:"revfly",   name:"Reverse Fly",    sets:3, reps:15, rest:120, weight:6 },
    { id:"ezcurl",   name:"EZ Bar Curls",   sets:3, reps:15, rest:120, weight:15 },
  ]},
  { id:"legs", label:"Leg Day", color:"#A8E6CF", isRest:false, exercises:[
    { id:"squat",  name:"Squat",                sets:3, reps:10, rest:180, weight:55 },
    { id:"rdl",    name:"Romanian Deadlift",    sets:3, reps:15, rest:120, weight:35 },
    { id:"calf",   name:"One Leg Calf Raises",  sets:2, reps:15, rest:30,  weight:0 },
    { id:"crunch", name:"Crunches",             sets:2, reps:15, rest:30,  weight:0 },
  ]},
  { id:"rest1", label:"Rest Day", color:"#444", isRest:true, exercises:[] },
  { id:"upper", label:"Upper Day", color:"#C77DFF", isRest:false, exercises:[
    { id:"bench_u",   name:"Bench Press",     sets:3, reps:8,  rest:180, weight:65 },
    { id:"bbrow_u",   name:"Barbell Row",     sets:2, reps:8,  rest:180, weight:45 },
    { id:"lateral_u", name:"Lateral Raises",  sets:2, reps:10, rest:30,  weight:10 },
    { id:"pullup_u",  name:"Pull Ups",        sets:2, reps:8,  rest:60,  weight:0 },
    { id:"fly_u",     name:"Dumbbell Fly",    sets:2, reps:10, rest:120, weight:10 },
    { id:"preacher",  name:"Preacher Curls",  sets:2, reps:10, rest:30,  weight:20 },
    { id:"skull_u",   name:"Skullcrushers",   sets:2, reps:10, rest:30,  weight:25 },
  ]},
  { id:"lower", label:"Lower Day", color:"#FFD166", isRest:false, exercises:[
    { id:"squat_l",  name:"Squat",               sets:3, reps:8,  rest:180, weight:60 },
    { id:"rdl_l",    name:"Romanian Deadlift",   sets:3, reps:10, rest:120, weight:45 },
    { id:"calf_l",   name:"One Leg Calf Raises", sets:2, reps:10, rest:30,  weight:15 },
    { id:"crunch_l", name:"Crunches",            sets:3, reps:10, rest:30,  weight:0 },
  ]},
  { id:"rest2", label:"Rest Day", color:"#444", isRest:true, exercises:[] },
];

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

const DEFAULT_TRACKER_GOALS = [
  { id:"calories", name:"Calories",    unit:"kcal", target:2500, color:"#7c3aed", builtIn:true, category:"Food",         type:"macro" },
  { id:"protein",  name:"Protein",     unit:"g",    target:150,  color:"#4ECDC4", builtIn:true, category:"Food",         type:"macro" },
  { id:"carbs",    name:"Carbs",       unit:"g",    target:250,  color:"#FFD166", builtIn:true, category:"Food",         type:"macro" },
  { id:"fat",      name:"Fat",         unit:"g",    target:70,   color:"#f59e0b", builtIn:true, category:"Food",         type:"macro" },
  { id:"water",    name:"Water",       unit:"glasses", target:8, color:"#06b6d4", builtIn:true, category:"Body",         type:"number" },
  { id:"weight",   name:"Body Weight", unit:"kg",   target:null, color:"#C77DFF", builtIn:true, category:"Body",         type:"number" },
  { id:"creatine", name:"Creatine",    unit:"",     target:null, color:"#a78bfa", builtIn:true, category:"Supplements",  type:"boolean" },
];
const DEFAULT_MEALS = [
  { id:"m_chicken",  name:"Chicken & Rice",       calories:650, protein:45, carbs:72, fat:8  },
  { id:"m_oats",     name:"Oats + Protein Shake", calories:430, protein:32, carbs:60, fat:7  },
  { id:"m_eggs",     name:"Scrambled Eggs (3)",   calories:210, protein:18, carbs:2,  fat:14 },
  { id:"m_tuna",     name:"Tuna Salad",           calories:320, protein:35, carbs:12, fat:10 },
];
const TRACKER_PALETTE = ["#FF6B35","#4ECDC4","#C77DFF","#FFD166","#4CAF50","#f59e0b","#a78bfa","#ee6b6e","#06b6d4","#f43f5e","#84cc16","#ec4899"];

function getDayStatus(dateObj, program, history, startDate) {
  const base = new Date(startDate);
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const today = new Date(); today.setHours(0,0,0,0);
  const daysSince = Math.floor((d - new Date(base.getFullYear(),base.getMonth(),base.getDate())) / (1000*60*60*24));
  if (daysSince < 0) return "future";
  const idx = ((daysSince % program.length) + program.length) % program.length;
  const day = program[idx];
  if (!day) return "future";
  if (day.isRest) return "rest";
  if (d > today) return "future";
  const sessions = history.filter(h => h.dayKey === day.id && new Date(h.date).toDateString() === d.toDateString());
  if (!sessions.length) return "missed";
  const allDone = sessions.some(s =>
    s.exercises?.filter(e=>!e.skipped).every(ex =>
      ex.sets?.filter(st=>!st.skipped&&(st.setType==="normal"||st.setType==="drop"||!st.setType)).every(st=>st.done||st.reps)
    )
  );
  return allDone ? "done" : "partial";
}

function calcStreak(history, program) {
  const startDate = ls.get("gr_start", null);
  if (!startDate || !history.length) return 0;
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let d = 0; d <= 365; d++) {
    const date = new Date(today); date.setDate(today.getDate() - d);
    const status = getDayStatus(date, program, history, startDate);
    if (status === "rest" || status === "future") continue;
    if (status === "done" || status === "partial") streak++;
    else break;
  }
  return streak;
}

function calcBestStreak(history, program) {
  const startDate = ls.get("gr_start", null);
  if (!startDate || !history.length) return 0;
  let best = 0, cur = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let d = 365; d >= 0; d--) {
    const date = new Date(today); date.setDate(today.getDate() - d);
    const status = getDayStatus(date, program, history, startDate);
    if (status === "rest" || status === "future") continue;
    if (status === "done" || status === "partial") { cur++; if (cur > best) best = cur; }
    else cur = 0;
  }
  return best;
}

const THEMES = [
  { id:"orange", label:"Orange", accent:"#FF4D1C", accent2:"#FF7A50", rgb:"255,77,28"   },
  { id:"blue",   label:"Blue",   accent:"#3B82F6", accent2:"#60a5fa", rgb:"59,130,246"  },
  { id:"green",  label:"Green",  accent:"#22C55E", accent2:"#4ade80", rgb:"34,197,94"   },
  { id:"violet", label:"Violet", accent:"#7c3aed", accent2:"#a78bfa", rgb:"124,58,237"  },
];

function useDragList(items, setItems) {
  const dragIdx = useRef(null);
  const overIdx = useRef(null);
  const onDragStart = (e, i) => { dragIdx.current = i; e.dataTransfer.effectAllowed = "move"; };
  const onDragEnter = (e, i) => { e.preventDefault(); overIdx.current = i; };
  const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e, i) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === i) return;
    const arr = [...items];
    const [moved] = arr.splice(from, 1);
    arr.splice(i, 0, moved);
    setItems(arr);
    dragIdx.current = null; overIdx.current = null;
  };
  const onDragEnd = () => { dragIdx.current = null; overIdx.current = null; };
  return { onDragStart, onDragEnter, onDragOver, onDrop, onDragEnd };
}

function MiniCalendar({program, history, todayIdx, startDate, onExpand}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  if (!startDate) return null;

  const today = new Date(); today.setHours(0,0,0,0);
  const base = new Date(startDate);
  const baseMidnight = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const days = Array.from({length: 7}, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOfWeek + i + weekOffset * 7);
    const status = getDayStatus(date, program, history, startDate);
    const isToday = date.toDateString() === today.toDateString();
    const daysSince = Math.floor((date - baseMidnight) / (1000*60*60*24));
    const idx = daysSince >= 0 ? ((daysSince % program.length) + program.length) % program.length : -1;
    const day = idx >= 0 ? program[idx] : null;
    return { day, date, status, isToday };
  });

  const weekLabel = weekOffset === 0 ? "THIS WEEK"
    : weekOffset < 0 ? `${Math.abs(weekOffset)} WEEK${Math.abs(weekOffset)>1?"S":""} AGO`
    : `IN ${weekOffset} WEEK${weekOffset>1?"S":""}`;

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) setWeekOffset(o => o + (dx < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const statusBg = { done:"#0d200d", partial:"#1a1400", missed:"#200d0d", rest:"transparent", future:"transparent" };
  const statusDot = { done:"#4CAF50", partial:"#f59e0b", missed:"#e24b4a" };

  return (
    <div className="card" style={{userSelect:"none",touchAction:"pan-y",position:"relative"}}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button onClick={()=>setWeekOffset(w=>w-1)} style={{position:"absolute",top:"50%",left:0,transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",fontSize:24,cursor:"pointer",zIndex:5,padding:"0 8px",lineHeight:1,touchAction:"manipulation"}}>&#8249;</button>
      <button onClick={()=>setWeekOffset(w=>w+1)} style={{position:"absolute",top:"50%",right:0,transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",fontSize:24,cursor:"pointer",zIndex:5,padding:"0 8px",lineHeight:1,touchAction:"manipulation"}}>&#8250;</button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,paddingLeft:20,paddingRight:20}}>
        <div style={{display:"flex",flexDirection:"column"}}>
          <div className="ctitle" style={{marginBottom:0}}>{weekLabel}</div>
          {weekOffset===0&&<div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>swipe or tap arrows</div>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {weekOffset !== 0 && (
            <button onClick={()=>setWeekOffset(0)} style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:6,padding:"2px 8px",cursor:"pointer",color:"var(--muted)",fontSize:11}}>NOW</button>
          )}
          {onExpand && <button onClick={onExpand} style={{background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",color:"var(--muted2)",fontSize:11,fontWeight:600,letterSpacing:.3}}>Full ›</button>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {days.map(({day, date, status, isToday}, i) => {
          const isRest = !day || day.isRest;
          const bg = isRest ? "transparent" : (statusBg[status] || "var(--s2)");
          const letter = isRest ? "" : (day.label?.[0]?.toUpperCase() ?? "?");
          const letterColor = status === "done" ? "#4CAF50" : status === "partial" ? "#f59e0b" : status === "missed" ? "#e24b4a" : (day?.color + "99");
          return (
            <div key={i} style={{aspectRatio:"1",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,background:bg,border:isToday?"1.5px solid var(--accent)":"1px solid var(--border)"}}>
              {!isRest && <>
                <div style={{fontWeight:700,fontSize:13,color:letterColor,lineHeight:1}}>{letter}</div>
                <div style={{fontSize:8,color:"var(--muted)",lineHeight:1}}>{date.getDate()}/{date.getMonth()+1}</div>
                {statusDot[status] && <div style={{width:4,height:4,borderRadius:"50%",background:statusDot[status]}}/>}
              </>}
              {isRest && <div style={{fontSize:8,color:"var(--border2)",lineHeight:1}}>{date.getDate()}/{date.getMonth()+1}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SetTypePicker({sets, si, onSelect}) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const s = sets[si];
  const label = getSetLabel(sets, si);
  const isWarmup = s.setType === "warmup";
  const isDrop   = s.setType === "drop";
  const typeColor = isWarmup ? "#f59e0b" : isDrop ? "#a78bfa" : s.done ? "#4CAF50" : "#FF6B35";
  const typeBg    = isWarmup ? "rgba(245,158,11,.15)" : isDrop ? "rgba(167,139,250,.15)" : s.done ? "rgba(76,175,80,.15)" : "var(--s3)";

  useEffect(() => {
    if (!pos) return;
    const fn = (e) => {
      const popup = document.querySelector(".type-picker-popup");
      if (btnRef.current?.contains(e.target) || popup?.contains(e.target)) return;
      setPos(null);
    };
    document.addEventListener("pointerdown", fn);
    return () => document.removeEventListener("pointerdown", fn);
  }, [pos]);

  const handleOpen = () => {
    if (pos) { setPos(null); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 140 ? rect.bottom + 4 : rect.top - 144;
    setPos({ top, left: rect.left });
  };

  const options = [
    { type:"normal",  label:"Normal",   badge:"1", color:"#7c3aed", bg:"rgba(124,58,237,.15)" },
    { type:"warmup",  label:"Warm-up",  badge:"W", color:"#f59e0b", bg:"rgba(245,158,11,.15)" },
    { type:"drop",    label:"Drop set", badge:"D", color:"#a78bfa", bg:"rgba(167,139,250,.15)" },
  ];

  return (
    <>
      <div ref={btnRef} onClick={handleOpen}
        style={{width:32,height:32,borderRadius:8,background:typeBg,border:`1.5px solid ${typeColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:typeColor,cursor:"pointer",userSelect:"none",flexShrink:0,transition:"all .15s"}}>
        {label}
      </div>
      {pos && (
        <div className="type-picker-popup" style={{top:pos.top,left:pos.left}} onClick={e=>e.stopPropagation()}>
          {options.map(o => (
            <div key={o.type} className="type-picker-item" onPointerDown={e=>{e.stopPropagation(); onSelect(o.type); setPos(null);}}>
              <div className="type-picker-badge" style={{background:o.bg,color:o.color}}>{o.badge}</div>
              <span style={{color:o.color}}>{o.label}</span>
              {(s.setType??"normal") === o.type && <span style={{marginLeft:"auto",color:o.color}}>&#10003;</span>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#111111;--s1:#1a1a1a;--s2:#222222;--s3:#2c2c2c;
  --border:#2e2e2e;--border2:#3a3a3a;--text:#f2f2f2;
  --muted:#5a5a5a;--muted2:#909090;
  --accent:#FF4D1C;--accent2:#FF7A50;--accent-rgb:255,77,28;
  --green:#22C55E;--gbg:#071a0e;--gborder:#16532a;
  --r:12px;--df:'DM Sans',sans-serif;--db:'DM Sans',sans-serif;
  --shadow:0 2px 12px rgba(0,0,0,.5);
}
body{background:var(--bg);color:var(--text);font-family:var(--db);-webkit-tap-highlight-color:transparent;}
input[type=number]{-moz-appearance:textfield;}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
input[type=date],input[type=text],input[type=number]{color-scheme:dark;}
.app{max-width:430px;margin:0 auto;height:100svh;display:flex;flex-direction:column;overflow:hidden;}

.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(17,17,17,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid var(--border);display:flex;z-index:100;padding-bottom:env(safe-area-inset-bottom,6px);}
.nbtn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 6px;background:none;border:none;cursor:pointer;color:var(--muted2);font-family:var(--db);font-size:9px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;transition:color .15s;position:relative;}
.nbtn.on{color:var(--accent);}
.nbtn.on::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);width:24px;height:2px;border-radius:0 0 2px 2px;background:var(--accent);}
.nbtn svg{width:22px;height:22px;}

.phdr{padding:52px 20px 18px;background:var(--s1);border-bottom:1px solid var(--border);}
.phdr h1{font-size:24px;font-weight:800;letter-spacing:-0.3px;color:var(--text);}
.phdr p{color:var(--muted2);font-size:13px;margin-top:4px;}
.scroll{flex:1;overflow-y:auto;padding:16px 16px 100px;-webkit-overflow-scrolling:touch;}

.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;}
.ctitle{font-size:10px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted2);margin-bottom:12px;}

.btn-accent{width:100%;padding:15px;background:var(--accent);color:#fff;border:none;border-radius:var(--r);font-size:15px;font-weight:700;letter-spacing:0;cursor:pointer;transition:opacity .15s,transform .1s;}
.btn-accent:active{transform:scale(.98);opacity:.85;}
.btn-ghost{background:var(--s2);border:1px solid var(--border2);border-radius:10px;padding:8px 14px;font-size:12px;color:var(--muted2);cursor:pointer;font-family:var(--db);transition:all .15s;}
.btn-ghost:hover{color:var(--text);border-color:var(--muted);}
.btn-danger{background:transparent;border:1px solid #3d1212;border-radius:10px;padding:6px 14px;font-size:12px;color:#e05555;cursor:pointer;font-family:var(--db);}
.btn-icon{background:none;border:none;cursor:pointer;color:var(--muted2);padding:6px;display:flex;align-items:center;border-radius:8px;transition:all .15s;}
.btn-icon:hover{color:var(--text);background:var(--s2);}

.day-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:0.5px;padding:3px 12px;border-radius:20px;margin-bottom:8px;}
.day-label{font-weight:800;font-size:28px;letter-spacing:-0.5px;margin-bottom:6px;}
.ex-preview{display:flex;flex-direction:column;gap:6px;margin:12px 0;}
.ex-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--s2);border-radius:10px;font-size:13px;border:1px solid var(--border);}
.prog-pill{font-size:10px;padding:2px 8px;border-radius:20px;background:var(--gbg);color:#7ec87e;border:1px solid var(--gborder);}

.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
.stat-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px 12px;}
.stat-lbl{font-size:9px;font-weight:600;color:var(--muted2);letter-spacing:0.8px;text-transform:uppercase;margin-bottom:4px;}
.stat-num{font-weight:800;font-size:30px;letter-spacing:-0.5px;line-height:1;}

.hdr-row{display:flex;justify-content:space-between;align-items:center;}
.streak-chip{display:flex;align-items:center;gap:5px;font-size:14px;font-weight:700;letter-spacing:0;padding:7px 14px;background:var(--s2);border-radius:20px;border:1px solid var(--border2);}

.w-header{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--s1);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;}
.back-btn{width:38px;height:38px;background:var(--s2);border:1px solid var(--border2);border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);flex-shrink:0;}
.ex-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);margin:0 14px 12px;overflow:hidden;transition:border-color .2s,background .3s;}
.ex-card.ex-done{border-color:var(--gborder);background:rgba(7,26,7,.8);}
.ex-card.ex-skip{opacity:.35;}
.ex-chead{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--border);}
.ex-cname{font-weight:600;font-size:15px;}
.ex-cmeta{color:var(--muted2);font-size:12px;margin-top:2px;}
.ai-banner{margin:0 14px 10px;padding:11px 14px;border-radius:12px;font-size:13px;line-height:1.55;border-left:2px solid var(--accent);background:rgba(var(--accent-rgb),.06);color:var(--accent2);}
.ai-banner.good{border-color:var(--green);background:var(--gbg);color:#4ade80;}

.set-table{width:100%;border-collapse:collapse;}
.set-table-head th{font-size:10px;font-weight:700;color:var(--muted2);letter-spacing:1px;text-transform:uppercase;padding:8px 6px;text-align:center;border-bottom:1px solid var(--border);}
.set-table-head th:first-child{text-align:left;padding-left:15px;}
.set-row{border-bottom:1px solid var(--border);transition:background .15s;}
.set-row:last-child{border-bottom:none;}
.set-row td{padding:8px 5px;text-align:center;vertical-align:middle;}
.set-row.row-done{background:#071a0e;}
.set-row.row-warmup{background:rgba(245,158,11,.05);}
.set-row.row-drop{background:rgba(var(--accent-rgb),.04);}
.set-row.row-skip{opacity:.3;}
.set-field{background:var(--s3);border:1.5px solid var(--border2);border-radius:9px;color:var(--text);font-size:16px;font-weight:600;text-align:center;padding:6px 2px;width:58px;outline:none;font-family:var(--db);transition:border-color .15s;}
.set-field:focus{border-color:var(--accent);}
.set-row.row-done .set-field{border-color:var(--gborder);background:#071a0e;color:#4ade80;}
.set-check{width:34px;height:34px;border-radius:50%;border:2px solid var(--border2);background:var(--s3);display:flex;align-items:center;justify-content:center;cursor:pointer;margin:0 auto;transition:all .2s;}
.set-check.checked{background:#071a0e;border-color:var(--green);}
.set-prev{font-size:11px;color:var(--muted2);}
.set-skip-x{width:20px;height:20px;border-radius:4px;background:var(--s3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);cursor:pointer;flex-shrink:0;}
.add-set-btn{width:100%;padding:11px;background:none;border:none;color:var(--muted2);font-family:var(--db);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid var(--border);transition:color .15s;}
.add-set-btn:hover{color:var(--text);}
.set-type-chip{font-weight:700;font-size:13px;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.type-picker-popup{position:fixed;background:var(--s1);border:1px solid var(--border2);border-radius:14px;z-index:9999;padding:6px;min-width:140px;box-shadow:0 16px 48px rgba(0,0,0,.9);}
.type-picker-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;transition:background .1s;}
.type-picker-item:hover{background:var(--s2);}
.type-picker-badge{font-weight:700;font-size:13px;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.prog-day-actions{display:flex;gap:2px;align-items:center;}

.rest-overlay{position:fixed;inset:0;background:rgba(11,11,11,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;}
.rest-close{position:absolute;top:20px;right:20px;width:40px;height:40px;background:var(--s2);border:1px solid var(--border2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--muted2);cursor:pointer;line-height:1;}
.rest-lbl{font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:var(--muted2);margin-bottom:8px;}
.rest-num{font-weight:800;font-size:108px;letter-spacing:-6px;line-height:1;}
.rest-skip{margin-top:48px;padding:16px 48px;background:var(--s2);border:1px solid var(--border2);border-radius:32px;color:var(--muted2);font-size:15px;font-weight:600;letter-spacing:0;cursor:pointer;transition:all .15s;}
.rest-skip:hover{color:var(--text);border-color:var(--muted2);}

.note-wrap{padding:0 14px 12px;}
.note-lbl{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-bottom:6px;}
.note-ta{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--db);font-size:14px;padding:10px 12px;resize:none;min-height:64px;outline:none;transition:border-color .15s;}
.note-ta:focus{border-color:var(--accent);}
.finish-btn{display:block;width:calc(100% - 28px);margin:0 14px 14px;padding:15px;background:var(--gbg);border:1px solid var(--gborder);border-radius:var(--r);color:#7ec87e;font-size:15px;font-weight:700;letter-spacing:0;cursor:pointer;transition:background .2s;}

.hist-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px;cursor:pointer;transition:all .2s;}
.hist-card:active{transform:scale(.99);}
.hist-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border);}
.hist-row:last-of-type{border-bottom:none;}

.chat-wrap{display:flex;flex-direction:column;height:calc(100dvh - 56px);overflow:hidden;position:relative;}
.chat-msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:8px;min-height:0;-webkit-overflow-scrolling:touch;}
.msg{max-width:86%;}
.msg.user{align-self:flex-end;}
.msg.ai{align-self:flex-start;}
.bubble{padding:11px 14px;border-radius:18px;font-size:14px;line-height:1.6;word-break:break-word;}
.msg.user .bubble{background:var(--accent);color:#fff;border-bottom-right-radius:4px;}
.msg.ai .bubble{background:var(--s2);border:1px solid var(--border);border-bottom-left-radius:4px;}
.msg-time{font-size:10px;color:var(--muted);margin-top:3px;padding:0 3px;}
.chat-bar{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--s1);border-top:1px solid var(--border);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));min-height:64px;}
.chat-in{flex:1;background:var(--s2);border:1.5px solid var(--border2);border-radius:22px;color:var(--text);font-size:16px;padding:10px 16px;outline:none;min-width:0;min-height:44px;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text;display:block;box-sizing:border-box;transition:border-color .15s;}
.chat-in:focus{border-color:var(--accent);}
.send-btn{width:44px;height:44px;min-width:44px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s;flex-shrink:0;}
.send-btn:active{opacity:.8;}
.typing{display:flex;gap:5px;align-items:center;padding:2px 0;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--muted2);animation:blink 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes blink{0%,80%,100%{opacity:.2;}40%{opacity:1;}}

.srow{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);}
.srow:last-child{border-bottom:none;}
.slbl{font-size:15px;font-weight:500;}
.ssub{font-size:12px;color:var(--muted2);margin-top:2px;}
.tog{width:46px;height:26px;border-radius:13px;background:var(--border2);position:relative;cursor:pointer;transition:background .2s;border:none;flex-shrink:0;}
.tog.on{background:var(--accent);}
.tog::after{content:'';position:absolute;width:20px;height:20px;border-radius:50%;background:#fff;top:3px;left:3px;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.4);}
.tog.on::after{transform:translateX(20px);}

.prog-day-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;}
.prog-day-header{display:flex;align-items:center;gap:10px;padding:13px 15px;border-bottom:1px solid var(--border);}
.prog-day-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.prog-day-name{font-weight:600;font-size:15px;flex:1;}
.drag-handle{cursor:grab;color:var(--muted);padding:4px 6px;display:flex;align-items:center;touch-action:none;user-select:none;}
.drag-handle:active{cursor:grabbing;}

.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:var(--s1);border-radius:24px 24px 0 0;border-top:1px solid var(--border2);padding:22px;width:100%;max-width:430px;max-height:90svh;overflow-y:auto;}
.modal-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.modal-title{font-weight:800;font-size:20px;letter-spacing:-0.3px;}
.form-lbl{font-size:10px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted2);margin-bottom:6px;}
.form-input{width:100%;background:var(--s2);border:1.5px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--db);font-size:15px;padding:11px 13px;outline:none;transition:border-color .15s;}
.form-input:focus{border-color:var(--accent);}
.mini-input{background:var(--s2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--db);font-size:13px;padding:4px 8px;width:100%;text-align:center;outline:none;}

.login{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:var(--bg);}
.login-logo{font-weight:800;font-size:52px;letter-spacing:-2px;color:var(--accent);}
.login-tagline{color:var(--muted2);font-size:15px;margin:8px 0 52px;line-height:1.8;}
.google-btn{display:flex;align-items:center;gap:12px;padding:14px 28px;background:var(--s1);border:1px solid var(--border2);border-radius:var(--r);color:var(--text);font-family:var(--db);font-size:16px;font-weight:500;cursor:pointer;margin-bottom:14px;transition:background .15s;}
.google-btn:hover{background:var(--s2);}
.demo-lnk{background:none;border:none;color:var(--muted2);font-family:var(--db);font-size:13px;cursor:pointer;text-decoration:underline;margin-top:4px;}

.proposal-btns{display:flex;gap:8px;margin-top:12px;}
.cat-bar{display:flex;gap:6px;padding:10px 16px;overflow-x:auto;background:var(--s1);border-bottom:1px solid var(--border);scrollbar-width:none;flex-shrink:0;}
.cat-bar::-webkit-scrollbar{display:none;}
.cat-pill{padding:5px 14px;border-radius:20px;border:1px solid var(--border2);background:var(--s2);color:var(--muted2);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;letter-spacing:.3px;}
.cat-pill.on{background:var(--accent);border-color:var(--accent);color:#fff;}
.big-cal{position:fixed;inset:0;background:var(--bg);z-index:500;display:flex;flex-direction:column;max-width:430px;margin:0 auto;}
.big-cal-head{padding:52px 18px 14px;background:var(--s1);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12;}
.big-cal-nav{display:flex;align-items:center;justify-content:space-between;padding:14px 6px 8px;}
.big-cal-nav-btn{background:none;border:none;color:var(--muted2);font-size:26px;cursor:pointer;padding:0 10px;line-height:1;}
.big-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:0 2px;}
.big-cal-dow{text-align:center;font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted2);padding:4px 0;}
.big-cal-day{aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:1px solid var(--border);transition:background .15s;}
.big-cal-day.today{border-color:var(--accent)!important;}
.big-cal-day.clickable{cursor:pointer;}
.big-cal-day.clickable:active{opacity:.7;}

.chat-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;gap:20px;}
.chat-empty-avatar{width:64px;height:64px;border-radius:50%;background:var(--s2);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--muted2);}
.chat-empty-title{font-weight:700;font-size:20px;letter-spacing:-0.2px;text-align:center;}
.chat-empty-sub{font-size:13px;color:var(--muted2);text-align:center;line-height:1.7;max-width:280px;}
.quick-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px;}
.quick-chip{padding:9px 16px;border-radius:20px;border:1px solid var(--border2);background:var(--s2);color:var(--muted2);font-size:12.5px;font-weight:500;cursor:pointer;transition:all .15s;line-height:1;}
.quick-chip:hover{border-color:var(--accent);color:var(--accent2);}

.ai-avatar{width:26px;height:26px;border-radius:50%;background:var(--s3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;letter-spacing:0;color:var(--muted2);flex-shrink:0;margin-bottom:auto;margin-top:2px;}
.msg-row{display:flex;gap:8px;align-items:flex-start;}
.msg.ai .bubble strong{color:var(--text);}
.msg.ai .bubble ul,.msg.ai .bubble ol{padding-left:16px;margin:4px 0;}

.proposal-card{background:var(--s2);border:1px solid var(--border2);border-radius:14px;padding:14px;max-width:92%;align-self:flex-start;margin-top:4px;}
.proposal-title{font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:var(--muted2);margin-bottom:10px;}
.proposal-change{font-size:12.5px;padding:6px 0;border-bottom:1px solid var(--border);line-height:1.5;}
.proposal-change:last-of-type{border-bottom:none;}
.proposal-accept{flex:1;padding:10px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:600;letter-spacing:0;cursor:pointer;transition:opacity .15s;}
.proposal-accept:hover{opacity:.88;}
.proposal-dismiss{padding:10px 16px;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:var(--muted2);font-family:var(--db);font-size:12px;cursor:pointer;}
.macro-big{font-weight:800;font-size:42px;letter-spacing:-1px;line-height:1;}
.macro-sub{display:flex;gap:8px;margin-top:8px;}
.macro-mini{flex:1;background:var(--s2);border-radius:12px;padding:10px 12px;border:1px solid var(--border);cursor:pointer;transition:border-color .15s;}
.macro-mini:hover{border-color:var(--border2);}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.add-mini-btn{font-size:11px;font-weight:700;color:var(--accent2);background:none;border:none;cursor:pointer;padding:4px 8px;border-radius:8px;letter-spacing:.5px;font-family:var(--db);}
.add-mini-btn:hover{background:rgba(var(--accent-rgb),.1);}
.habit-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;}
.done-btn{padding:7px 16px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:all .15s;border:none;font-family:var(--db);}
.done-btn.done{background:rgba(76,175,80,.15);border:1px solid rgba(76,175,80,.35);color:var(--green);}
.done-btn.notdone{background:var(--s2);border:1px solid var(--border2);color:var(--muted2);}
.log-btn{padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;font-family:var(--db);border:none;}
.log-btn.logged{background:rgba(var(--accent-rgb),.15);border:1px solid rgba(var(--accent-rgb),.35);color:var(--accent2);}
.log-btn.notlogged{background:var(--s2);border:1px solid var(--border2);color:var(--muted2);}
.metric-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;}
.metric-ctrl{display:flex;align-items:center;gap:6px;}
.metric-field{width:60px;background:var(--s3);border:1.5px solid var(--border2);border-radius:10px;color:var(--text);font-weight:700;font-size:18px;text-align:center;padding:6px 2px;outline:none;transition:border-color .15s;}
.metric-field:focus{border-color:var(--accent);}
.step-btn{width:30px;height:30px;border-radius:8px;background:var(--s2);border:1px solid var(--border2);color:var(--muted2);font-size:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;line-height:1;flex-shrink:0;transition:all .15s;}
.step-btn:hover{color:var(--text);}
.trk-cal-btn{background:var(--s2);border:1px solid var(--border2);border-radius:10px;padding:7px 12px;cursor:pointer;color:var(--muted2);font-size:12px;font-weight:600;display:flex;align-items:center;gap:5px;}

@keyframes slideInLeft{from{opacity:0;transform:translateX(-6%);}to{opacity:1;transform:translateX(0);}}
@keyframes slideInRight{from{opacity:0;transform:translateX(6%);}to{opacity:1;transform:translateX(0);}}
.tab-slide-left{animation:slideInLeft .18s cubic-bezier(.4,0,.2,1) both;}
.tab-slide-right{animation:slideInRight .18s cubic-bezier(.4,0,.2,1) both;}

.stats-overlay{position:fixed;inset:0;background:var(--bg);z-index:400;display:flex;flex-direction:column;max-width:430px;margin:0 auto;overflow:hidden;}
.stats-chart-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;}
.stats-ex-pill{padding:6px 14px;border-radius:20px;border:1px solid var(--border2);background:var(--s2);color:var(--muted2);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;}
.stats-ex-pill.on{background:var(--accent);border-color:var(--accent);color:#fff;}

.rest-pill{position:fixed;bottom:72px;right:16px;background:var(--s1);border:1.5px solid var(--accent);border-radius:28px;padding:10px 18px;display:flex;align-items:center;gap:10px;z-index:150;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,.7);animation:slideInRight .2s both;}
.rest-pill-num{font-weight:800;font-size:22px;letter-spacing:-0.5px;color:var(--accent);}

.finish-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:350;display:flex;align-items:flex-end;justify-content:center;}
.finish-modal{background:var(--s1);border-radius:24px 24px 0 0;border-top:1px solid var(--border2);padding:22px 22px 32px;width:100%;max-width:430px;max-height:85svh;overflow-y:auto;}
.incomplete-set{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;}
.incomplete-set:last-of-type{border-bottom:none;}

.edit-msg-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;transition:all .15s;opacity:0;}
.msg.user:hover .edit-msg-btn{opacity:1;}
.edit-msg-btn:hover{color:var(--muted2);background:rgba(255,255,255,.06);}
.editing-bubble{background:var(--s2);border:1.5px solid var(--accent);border-radius:14px;padding:10px 12px;width:100%;}
.editing-input{background:none;border:none;color:var(--text);font-size:14px;font-family:var(--db);width:100%;outline:none;resize:none;line-height:1.5;}
.branch-badge{font-size:9px;font-weight:700;letter-spacing:.5px;background:rgba(var(--accent-rgb),.15);color:var(--accent2);border:1px solid rgba(var(--accent-rgb),.3);border-radius:10px;padding:2px 7px;margin-left:6px;vertical-align:middle;}

.nutri-goal-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);}
.nutri-goal-row:last-child{border-bottom:none;}

.prog-day-card-today{position:relative;}

.stats-pills-scroll{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;margin-bottom:10px;}
.stats-pills-scroll::-webkit-scrollbar{display:none;}

.past-chat-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--s1);border-top:1px solid var(--border);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));}

.hist-card-inner{position:relative;padding-right:40px;}
.hist-card-del{position:absolute;top:50%;right:-2px;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;padding:8px;opacity:0;transition:opacity .15s;}
.hist-card:hover .hist-card-del{opacity:1;}

.msg-actions{display:flex;gap:2px;margin-top:4px;padding:0 1px;}
.msg-action-btn{background:none;border:none;color:var(--muted);cursor:pointer;padding:5px 7px;border-radius:7px;display:flex;align-items:center;gap:4px;font-size:11px;font-weight:500;transition:all .15s;font-family:var(--db);}
.msg-action-btn:hover{color:var(--muted2);background:rgba(255,255,255,.07);}
.msg-action-btn.copied{color:var(--green)!important;}
.msg.user .msg-actions{justify-content:flex-end;opacity:0.35;transition:opacity .15s;}
.msg.user:hover .msg-actions,.msg.user:focus-within .msg-actions{opacity:1;}

.stats-section-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;cursor:pointer;transition:border-color .15s;}
.stats-section-card:hover{border-color:var(--border2);}
.stats-section-preview{margin-top:10px;pointer-events:none;}
.stats-expand-caret{color:var(--muted2);transition:transform .2s;display:inline-flex;align-items:center;flex-shrink:0;}
.stats-expand-caret.open{transform:rotate(180deg);}
`;



const Ic = {
  Home:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  Dumbbell: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="10" width="4" height="4" rx="1"/><rect x="18" y="10" width="4" height="4" rx="1"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  Clock:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  Chat:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Cog:      ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Send:     ()=><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>,
  Back:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  Check:    ()=><svg viewBox="0 0 10 8" fill="none" stroke="#4CAF50" strokeWidth="2.5"><polyline points="1,4 4,7 9,1"/></svg>,
  Edit:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Trash:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Grip:     ()=><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>,
  Plus:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Google:   ()=><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>,
  Target:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>,
  Stats:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Bell:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Minimize:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Copy:        ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  Share:       ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Refresh:     ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  ChevronDown: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>,
};

function ExerciseSetTable({ ex, sets, editable=false, onTypeSelect, onWeightChange, onRepsChange, onRestChange, onFieldBlur, onSkip, onRemoveSet, onCheck, onAddSet }) {
  return (
    <table className="set-table">
      <thead className="set-table-head">
        <tr>
          <th style={{textAlign:"left",paddingLeft:14}}>SET</th>
          <th>PREV</th>
          <th>KG</th>
          <th>REPS</th>
          {editable && <th style={{textAlign:"right",paddingRight:10,fontSize:10}}>{onRemoveSet ? "REST (s)" : ""}</th>}
        </tr>
      </thead>
      <tbody>
        {sets.map((s, si) => {
          const t = s.setType ?? "normal";
          const isW = t === "warmup";
          const isD = t === "drop";
          const label = getSetLabel(sets, si);
          const typeColor = isW ? "#f59e0b" : isD ? "#a78bfa" : s.done ? "#4CAF50" : "#a78bfa";
          const typeBg   = isW ? "rgba(245,158,11,.18)" : isD ? "rgba(167,139,250,.18)" : s.done ? "rgba(76,175,80,.18)" : "var(--s3)";
          return (
            <tr key={si} className={`set-row ${s.done?"row-done":""} ${s.skipped?"row-skip":""} ${isW&&!s.done?"row-warmup":""} ${isD&&!s.done?"row-drop":""}`}>
              <td style={{paddingLeft:14,paddingRight:4,width:44}}>
                {editable && onTypeSelect
                  ? <SetTypePicker sets={sets} si={si} onSelect={t=>onTypeSelect(si,t)}/>
                  : <div style={{width:32,height:32,borderRadius:8,background:typeBg,border:`1.5px solid ${typeColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:typeColor,userSelect:"none",flexShrink:0}}>{label}</div>
                }
              </td>
              <td><span className="set-prev">{s.prevLabel ?? `${s.targetWeight??ex?.weight??0}kg x${s.targetReps??ex?.reps??0}`}</span></td>
              <td>
                {editable
                  ? <input className="set-field" type="number" value={s.weight??""} onChange={e=>onWeightChange&&onWeightChange(si,e.target.value)} onBlur={()=>onFieldBlur&&onFieldBlur(si)} disabled={s.skipped} style={{width:58}}/>
                  : <span style={{fontWeight:600,fontSize:15}}>{s.weight??s.targetWeight??""}</span>
                }
              </td>
              <td>
                {editable
                  ? <input className="set-field" type="number" placeholder={String(s.targetReps??ex?.reps??"")} value={s.reps??""} onChange={e=>onRepsChange&&onRepsChange(si,e.target.value)} onBlur={()=>onFieldBlur&&onFieldBlur(si)} disabled={s.skipped} style={{width:58}}/>
                  : <span style={{fontWeight:600,fontSize:15,color:s.done?"#88cc88":"var(--text)"}}>{s.reps||""}</span>
                }
              </td>
              {editable && (
                <td style={{paddingRight:10}}>
                  {onRemoveSet ? (
                    <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                      <input type="number" className="set-field" value={s.rest??ex?.rest??120} onChange={e=>onRestChange&&onRestChange(si,parseInt(e.target.value)||0)} style={{width:52,fontSize:13}}/>
                      <div className="set-skip-x" onClick={()=>onRemoveSet(si)}>&#x2715;</div>
                    </div>
                  ) : (
                    <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                      <div className={`set-check ${s.done?"checked":""}`} onClick={()=>!s.skipped&&onCheck&&onCheck(si)}>
                        {s.done&&<Ic.Check/>}
                      </div>
                      <div className="set-skip-x" onClick={()=>onSkip&&onSkip(si)}>
                        {s.skipped ? "+" : "-"}
                      </div>
                    </div>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
      {editable && onAddSet && (
        <tfoot>
          <tr><td colSpan={5}>
            <button className="add-set-btn" onClick={onAddSet}><Ic.Plus/> Add Set</button>
          </td></tr>
        </tfoot>
      )}
    </table>
  );
}

function DayEditor({day,onClose,onSave,onAddEx,onRemoveEx,onUpdateEx,onDelete}){
  const [label,setLabel]=useState(day.label);
  const [color,setColor]=useState(day.color);

  const handleAddSet=(exId)=>{
    const ex=day.exercises.find(e=>e.id===exId);
    if(!ex) return;
    const last=ex.sets-1;
    const newSets=ex.sets+1;
    onUpdateEx(exId,{
      sets:newSets,
      setTypePerSet:[...(ex.setTypePerSet||Array(ex.sets).fill("normal")),(ex.setTypePerSet||[])[last]??"normal"],
      repsPerSet:[...(ex.repsPerSet||Array(ex.sets).fill(ex.reps)),(ex.repsPerSet||[])[last]??ex.reps],
      weightPerSet:[...(ex.weightPerSet||Array(ex.sets).fill(ex.weight)),(ex.weightPerSet||[])[last]??ex.weight],
      restPerSet:[...(ex.restPerSet||Array(ex.sets).fill(ex.rest??120)),(ex.restPerSet||[])[last]??ex.rest??120],
    });
  };

  return(<div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="modal-title-row">
      <div className="modal-title">EDIT PROGRAM</div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:40,height:32,border:"none",borderRadius:8,cursor:"pointer",background:"none",padding:0}}/>
        <button onClick={onClose} style={{background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:8,width:32,height:32,cursor:"pointer",color:"var(--text)",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>&#x2715;</button>
      </div>
    </div>
    <div style={{marginBottom:14}}>
      <div className="form-lbl">Program name</div>
      <input className="form-input" value={label} onChange={e=>setLabel(e.target.value)}/>
    </div>
    <div style={{fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",color:"var(--muted2)",margin:"16px 0 8px"}}>Exercises</div>
    {day.exercises.map(ex=>{
      const sets=(ex.setTypePerSet||Array(ex.sets).fill("normal")).map((_,si)=>({
        setType:(ex.setTypePerSet||[])[si]??"normal",
        reps:(ex.repsPerSet||[])[si]??ex.reps,
        weight:(ex.weightPerSet||[])[si]??ex.weight,
        rest:(ex.restPerSet||[])[si]??ex.rest??120,
        prevLabel:null,
        targetReps:(ex.repsPerSet||[])[si]??ex.reps,
        targetWeight:(ex.weightPerSet||[])[si]??ex.weight,
      }));
      return(
        <div key={ex.id} style={{background:"var(--s2)",borderRadius:12,marginBottom:10,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px 8px"}}>
            <input className="form-input" style={{fontSize:14,padding:"6px 10px",flex:1}} value={ex.name} onChange={e=>onUpdateEx(ex.id,{name:e.target.value})}/>
            <button className="btn-icon" style={{color:"#cc6666",marginLeft:8,flexShrink:0}} onClick={()=>onRemoveEx(ex.id)}><Ic.Trash/></button>
          </div>
          <ExerciseSetTable ex={ex} sets={sets} editable={true}
            onTypeSelect={(si,t)=>{const a=[...(ex.setTypePerSet||Array(ex.sets).fill("normal"))];a[si]=t;onUpdateEx(ex.id,{setTypePerSet:a});}}
            onWeightChange={(si,val)=>{const a=[...(ex.weightPerSet||Array(ex.sets).fill(ex.weight))];a[si]=parseFloat(val)||0;onUpdateEx(ex.id,{weightPerSet:a});}}
            onRepsChange={(si,val)=>{const a=[...(ex.repsPerSet||Array(ex.sets).fill(ex.reps))];a[si]=parseInt(val)||0;onUpdateEx(ex.id,{repsPerSet:a});}}
            onRestChange={(si,val)=>{const a=[...(ex.restPerSet||Array(ex.sets).fill(ex.rest??120))];a[si]=val;onUpdateEx(ex.id,{restPerSet:a});}}
            onRemoveSet={(si)=>{
              if(ex.sets<=1) return;
              const splice=(arr,def)=>{const a=[...(arr||Array(ex.sets).fill(def))];a.splice(si,1);return a;};
              onUpdateEx(ex.id,{sets:ex.sets-1,setTypePerSet:splice(ex.setTypePerSet,"normal"),repsPerSet:splice(ex.repsPerSet,ex.reps),weightPerSet:splice(ex.weightPerSet,ex.weight),restPerSet:splice(ex.restPerSet,ex.rest??120)});
            }}
            onCheck={null}
            onAddSet={()=>handleAddSet(ex.id)}
          />
        </div>
      );
    })}
    <button style={{width:"100%",padding:10,background:"var(--s2)",border:"1px dashed var(--border2)",borderRadius:10,color:"var(--muted2)",cursor:"pointer",fontFamily:"var(--db)",fontSize:14,marginBottom:16,marginTop:4}} onClick={onAddEx}>+ Add exercise</button>
    <button className="btn-accent" onClick={()=>onSave({label,shortLabel:label.trim()[0]?.toUpperCase()??"?",color,exercises:day.exercises})}>SAVE</button>
    <div style={{display:"flex",gap:8,marginTop:8}}>
      <button style={{flex:1,padding:12,background:"none",border:"none",color:"var(--muted2)",cursor:"pointer",fontFamily:"var(--db)"}} onClick={onClose}>Cancel</button>
      {onDelete&&<button style={{padding:"12px 20px",background:"#200d0d",border:"1px solid #4a1010",borderRadius:"var(--r)",color:"#cc6666",cursor:"pointer",fontFamily:"var(--db)",fontSize:13}} onClick={()=>{if(window.confirm(`Delete "${day.label}"?`))onDelete();}}>Delete</button>}
    </div>
  </div></div>);
}

function WorkoutStats({exStates, elapsed, fmtTime}) {
  const totalVol = exStates.reduce((total, ex) => {
    if (ex.skipped) return total;
    return total + ex.sets.reduce((acc, s) => {
      if (s.skipped) return acc;
      return acc + (parseFloat(s.weight)||0) * (parseInt(s.reps)||0);
    }, 0);
  }, 0);
  return (
    <div style={{display:"flex",gap:0,background:"var(--s2)",borderBottom:"1px solid var(--border)"}}>
      <div style={{flex:1,padding:"10px 16px",borderRight:"1px solid var(--border)"}}>
        <div style={{fontSize:10,color:"var(--muted)",letterSpacing:.4,textTransform:"uppercase",marginBottom:2}}>Time</div>
        <div style={{fontWeight:800,fontSize:18,letterSpacing:-.5}}>{fmtTime(elapsed)}</div>
      </div>
      <div style={{flex:1,padding:"10px 16px"}}>
        <div style={{fontSize:10,color:"var(--muted)",letterSpacing:.4,textTransform:"uppercase",marginBottom:2}}>Volume</div>
        <div style={{fontWeight:800,fontSize:18,letterSpacing:-.5}}>{totalVol > 0 ? `${totalVol.toLocaleString()}kg` : "--"}</div>
      </div>
    </div>
  );
}

function playRestEndSound(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    [[880,0],[1046,0.18],[1318,0.36]].forEach(([freq,delay])=>{
      const osc=ctx.createOscillator();const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.type="sine";osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.28,ctx.currentTime+delay);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.28);
      osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+0.28);
    });
  }catch{}
}
function sendRestNotification(){
  if(Notification?.permission==="granted"){
    new Notification("Rest done! 💪",{body:"Time to get back to work.",silent:true});
  }
}
function requestNotificationPermission(){
  if(typeof Notification!=="undefined"&&Notification.permission==="default"){
    Notification.requestPermission().catch(()=>{});
  }
}

function MiniLineChart({data,color="#FF4D1C",height=60}){
  if(!data||data.length<2) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",fontSize:12}}>Not enough data</div>;
  const min=Math.min(...data),max=Math.max(...data);
  const range=max-min||1;
  const W=300,H=height;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*W},${H-(((v-min)/range)*(H-10)+5)}`).join(" ");
  const area=`M ${pts.split(" ").join(" L ")} L ${W},${H} L 0,${H} Z`;
  return(<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
    <defs><linearGradient id={`g${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
    <path d={area} fill={`url(#g${color.slice(1)})`}/>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    {data.map((v,i)=>{const x=(i/(data.length-1))*W;const y=H-(((v-min)/range)*(H-10)+5);return <circle key={i} cx={x} cy={y} r="3" fill={color} stroke="var(--s1)" strokeWidth="1.5"/>;  })}
  </svg>);
}

function BarChart({data,color="#FF4D1C",height=60}){
  if(!data||data.length===0) return null;
  const max=Math.max(...data.map(d=>d.v),1);
  const W=300,H=height;
  const bw=Math.floor(W/data.length)-2;
  return(<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height}} preserveAspectRatio="none">
    {data.map((d,i)=>{const bh=Math.max(2,(d.v/max)*(H-16));const x=i*(W/data.length);const isToday=d.today;return(
      <g key={i}>
        <rect x={x+1} y={H-bh-16} width={bw} height={bh} rx="3" fill={isToday?color:`${color}66`}/>
        <text x={x+bw/2+1} y={H-4} textAnchor="middle" fontSize="8" fill="var(--muted)" fontFamily="sans-serif">{d.label}</text>
      </g>
    );})}
  </svg>);
}

function InlineStats({history,program,trackerGoals,trackerLogs}){
  const [selEx,setSelEx]=useState(null);
  const exercises=program.flatMap(d=>d.exercises||[]);
  const exOptions=exercises.filter(ex=>history.some(h=>h.exercises?.find(e=>e.id===ex.id)));

  const weeklyData=(()=>{
    const weeks=[];
    for(let w=11;w>=0;w--){
      const wStart=new Date();wStart.setDate(wStart.getDate()-wStart.getDay()-w*7);wStart.setHours(0,0,0,0);
      const wEnd=new Date(wStart);wEnd.setDate(wStart.getDate()+7);
      const count=history.filter(h=>{const d=new Date(h.date);return d>=wStart&&d<wEnd&&!program.find(p=>p.id===h.dayKey)?.isRest;}).length;
      const label=wStart.toLocaleDateString("en",{month:"short",day:"numeric"}).slice(0,3);
      weeks.push({v:count,label:w===0?"Now":label,today:w===0});
    }
    return weeks;
  })();

  const volumeData=history.slice(-20).filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).map(h=>
    h.exercises?.reduce((s,ex)=>s+(ex.sets?.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0)||0),0)||0
  );

  const exData=selEx?(()=>{
    const sessions=history.filter(h=>h.exercises?.find(e=>e.id===selEx.id));
    return sessions.slice(-16).map(h=>{const ex=h.exercises?.find(e=>e.id===selEx.id);return Math.max(0,...(ex?.sets?.map(s=>parseFloat(s.weight)||0)||[]));});
  })():null;

  const bodyWeightData=(()=>{
    const bwGoal=trackerGoals?.find(g=>g.id==="weight");
    if(!bwGoal) return null;
    const pts=trackerLogs?.slice(-20).map(l=>parseFloat(l.entries?.[bwGoal.id])||null).filter(Boolean)||[];
    return pts.length>=2?pts:null;
  })();

  const totalSessions=history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const totalVolume=Math.round(history.reduce((s,h)=>s+(h.exercises?.reduce((ss,ex)=>ss+(ex.sets?.reduce((sss,st)=>sss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0)||0),0)||0),0));
  const avgDur=totalSessions?Math.round(history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).reduce((s,h)=>s+(h.duration||0),0)/totalSessions):0;

  return(<div>
    <div className="stats-row">
      <div className="stat-card"><div className="stat-lbl">Workouts</div><div className="stat-num">{totalSessions}</div></div>
      <div className="stat-card"><div className="stat-lbl">Avg Duration</div><div className="stat-num" style={{fontSize:22}}>{avgDur}min</div></div>
      <div className="stat-card"><div className="stat-lbl">Total Volume</div><div className="stat-num" style={{fontSize:20}}>{totalVolume>999?`${(totalVolume/1000).toFixed(1)}t`:`${totalVolume}kg`}</div></div>
    </div>
    <div className="stats-chart-card">
      <div className="ctitle">WEEKLY — LAST 12 WEEKS</div>
      <BarChart data={weeklyData} color="var(--accent)" height={80}/>
    </div>
    {volumeData.length>=2&&<div className="stats-chart-card">
      <div className="ctitle">VOLUME PER SESSION</div>
      <MiniLineChart data={volumeData} color="var(--accent)" height={70}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"var(--muted)"}}>
        <span>{Math.round(Math.min(...volumeData))}kg</span><span>{Math.round(Math.max(...volumeData))}kg peak</span>
      </div>
    </div>}
    {bodyWeightData&&<div className="stats-chart-card">
      <div className="ctitle">BODY WEIGHT TREND</div>
      <MiniLineChart data={bodyWeightData} color="#C77DFF" height={65}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"var(--muted)"}}>
        <span>{Math.min(...bodyWeightData)}kg</span><span>{Math.max(...bodyWeightData)}kg</span>
      </div>
    </div>}
    <div className="stats-chart-card">
      <div className="ctitle" style={{marginBottom:8}}>EXERCISE PROGRESSION</div>
      {exOptions.length===0&&<p style={{color:"var(--muted)",fontSize:13}}>Complete workouts to see charts.</p>}
      {exOptions.length>0&&<>
        <div className="stats-pills-scroll">
          {exOptions.map(ex=>(
            <button key={ex.id} className={`stats-ex-pill${selEx?.id===ex.id?" on":""}`} onClick={()=>setSelEx(ex.id===selEx?.id?null:ex)}>{ex.name}</button>
          ))}
        </div>
        {selEx&&exData&&exData.length>=2&&<>
          <div style={{fontSize:12,color:"var(--muted2)",marginBottom:6}}>{selEx.name} — top weight (kg)</div>
          <MiniLineChart data={exData} color={program.find(d=>d.exercises?.find(e=>e.id===selEx.id))?.color||"var(--accent)"} height={90}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"var(--muted)"}}>
            <span>Start: {Math.min(...exData)}kg</span>
            <span>Best: {Math.max(...exData)}kg</span>
            <span style={{color:"var(--accent2)",fontWeight:700}}>+{(Math.max(...exData)-Math.min(...exData)).toFixed(1)}kg</span>
          </div>
        </>}
        {selEx&&exData&&exData.length<2&&<p style={{color:"var(--muted)",fontSize:13,marginTop:8}}>Need 2+ sessions with {selEx.name}.</p>}
        {!selEx&&<p style={{color:"var(--muted)",fontSize:13}}>Tap an exercise to see its progression.</p>}
      </>}
    </div>
  </div>);
}

function StatsTab({history,program,trackerGoals,trackerLogs}){
  const [expanded,setExpanded]=useState(null);
  const [selEx,setSelEx]=useState(null);

  const wkH=history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest);
  const totalSessions=wkH.length;
  const now=new Date();
  const monthSessions=wkH.filter(h=>{const d=new Date(h.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).length;
  const bestStreak=calcBestStreak(history,program);
  const avgDur=totalSessions?Math.round(wkH.reduce((s,h)=>s+(h.duration||0),0)/totalSessions):0;
  const totalVol=Math.round(history.reduce((s,h)=>s+(h.exercises?.reduce((ss,ex)=>ss+(ex.sets?.reduce((sss,st)=>sss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0)||0),0)||0),0));
  const volDisplay=totalVol>999?`${(totalVol/1000).toFixed(1)}t`:`${totalVol}kg`;

  const weeklyData=(()=>{
    const weeks=[];
    for(let w=11;w>=0;w--){
      const s=new Date();s.setDate(s.getDate()-s.getDay()-w*7);s.setHours(0,0,0,0);
      const e=new Date(s);e.setDate(s.getDate()+7);
      const n=history.filter(h=>{const d=new Date(h.date);return d>=s&&d<e&&!program.find(p=>p.id===h.dayKey)?.isRest;}).length;
      weeks.push({v:n,label:w===0?"Now":s.toLocaleDateString("en",{month:"short",day:"numeric"}).slice(0,3),today:w===0});
    }
    return weeks;
  })();

  const volData=wkH.slice(-20).map(h=>h.exercises?.reduce((s,ex)=>s+(ex.sets?.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0)||0),0)||0);
  const exOpts=program.flatMap(d=>d.exercises||[]).filter(ex=>history.some(h=>h.exercises?.find(e=>e.id===ex.id)));
  const exData=selEx?(()=>{
    const ss=history.filter(h=>h.exercises?.find(e=>e.id===selEx.id));
    return ss.slice(-16).map(h=>{const ex=h.exercises?.find(e=>e.id===selEx.id);return Math.max(0,...(ex?.sets?.map(s=>parseFloat(s.weight)||0)||[]));});
  })():null;
  const bwData=(()=>{
    const g=trackerGoals?.find(x=>x.id==="weight");
    if(!g)return null;
    const pts=(trackerLogs||[]).slice(-20).map(l=>parseFloat(l.entries?.weight)||null).filter(Boolean);
    return pts.length>=2?pts:null;
  })();

  const tog=(k)=>setExpanded(e=>e===k?null:k);
  const miniIconStyle=(bg)=>({width:36,height:36,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0});
  const miniStat=(label,val)=>(
    <div style={{background:"var(--s2)",borderRadius:8,padding:"8px 10px"}}>
      <div style={{fontSize:9,color:"var(--muted2)",letterSpacing:.6,textTransform:"uppercase",marginBottom:2}}>{label}</div>
      <div style={{fontWeight:700,fontSize:16}}>{val}</div>
    </div>
  );

  if(totalSessions===0) return(
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:48,marginBottom:14}}>📊</div>
      <div style={{fontWeight:700,fontSize:16,marginBottom:6}}>No data yet</div>
      <div style={{fontSize:13,color:"var(--muted2)",lineHeight:1.8}}>Complete your first workout<br/>to start seeing stats here.</div>
    </div>
  );

  return(<div>
      {/* Top summary grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div className="stat-card" style={{gridColumn:"span 2",display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"14px 16px"}}>
          <div><div className="stat-lbl">TOTAL SESSIONS</div><div className="stat-num">{totalSessions}</div></div>
          <div style={{textAlign:"right"}}><div className="stat-lbl">THIS MONTH</div><div className="stat-num" style={{fontSize:28}}>{monthSessions}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">BEST STREAK</div>
          <div className="stat-num" style={{fontSize:26}}>{bestStreak}</div>
          <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>days 🔥</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">AVG SESSION</div>
          <div className="stat-num" style={{fontSize:26}}>{avgDur}</div>
          <div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>min</div>
        </div>
        <div className="stat-card" style={{gridColumn:"span 2",padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div><div className="stat-lbl">TOTAL VOLUME LIFTED</div><div className="stat-num" style={{fontSize:26}}>{volDisplay}</div></div>
            {volData.length>=3&&<div style={{width:90,flexShrink:0}}><MiniLineChart data={volData.slice(-8)} color="var(--accent)" height={40}/></div>}
          </div>
        </div>
      </div>

      {/* Weekly Activity */}
      <div className="stats-section-card" onClick={()=>tog("weekly")}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={miniIconStyle("rgba(255,100,50,.12)")}>📅</div>
            <div><div style={{fontWeight:700,fontSize:14}}>Weekly Activity</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>Last 12 weeks</div></div>
          </div>
          <span className={`stats-expand-caret${expanded==="weekly"?" open":""}`}><Ic.ChevronDown/></span>
        </div>
        {expanded!=="weekly"&&<div className="stats-section-preview"><BarChart data={weeklyData.slice(-6)} color="var(--accent)" height={44}/></div>}
        {expanded==="weekly"&&<div style={{marginTop:14}} onClick={e=>e.stopPropagation()}>
          <BarChart data={weeklyData} color="var(--accent)" height={80}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
            {miniStat("Best Week",`${Math.max(...weeklyData.map(w=>w.v))} sessions`)}
            {miniStat("Weekly Avg",`${weeklyData.length?Math.round((weeklyData.reduce((s,w)=>s+w.v,0)/weeklyData.length)*10)/10:0} sessions`)}
          </div>
        </div>}
      </div>

      {/* Volume Trend */}
      {volData.length>=2&&<div className="stats-section-card" onClick={()=>tog("volume")}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={miniIconStyle("rgba(78,205,196,.12)")}>📈</div>
            <div><div style={{fontWeight:700,fontSize:14}}>Volume Trend</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>kg lifted per session</div></div>
          </div>
          <span className={`stats-expand-caret${expanded==="volume"?" open":""}`}><Ic.ChevronDown/></span>
        </div>
        {expanded!=="volume"&&<div className="stats-section-preview"><MiniLineChart data={volData.slice(-6)} color="var(--accent)" height={44}/></div>}
        {expanded==="volume"&&<div style={{marginTop:14}} onClick={e=>e.stopPropagation()}>
          <MiniLineChart data={volData} color="var(--accent)" height={80}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
            {miniStat("Min",`${Math.round(Math.min(...volData))}kg`)}
            {miniStat("Avg",`${Math.round(volData.reduce((s,v)=>s+v,0)/volData.length)}kg`)}
            <div style={{background:"var(--s2)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:"var(--muted2)",letterSpacing:.6,textTransform:"uppercase",marginBottom:2}}>Peak</div>
              <div style={{fontWeight:700,fontSize:16,color:"var(--accent2)"}}>{Math.round(Math.max(...volData))}kg</div>
            </div>
          </div>
        </div>}
      </div>}

      {/* Exercise Progress */}
      {exOpts.length>0&&<div className="stats-section-card" onClick={()=>tog("exercise")}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={miniIconStyle("rgba(199,125,255,.12)")}>💪</div>
            <div><div style={{fontWeight:700,fontSize:14}}>Exercise Progress</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{exOpts.length} exercises tracked</div></div>
          </div>
          <span className={`stats-expand-caret${expanded==="exercise"?" open":""}`}><Ic.ChevronDown/></span>
        </div>
        {expanded!=="exercise"&&selEx&&exData&&exData.length>=2&&<div className="stats-section-preview"><MiniLineChart data={exData.slice(-6)} color={program.find(d=>d.exercises?.find(e=>e.id===selEx.id))?.color||"var(--accent)"} height={44}/></div>}
        {expanded==="exercise"&&<div style={{marginTop:14}} onClick={e=>e.stopPropagation()}>
          <div className="stats-pills-scroll">
            {exOpts.map(ex=>(
              <button key={ex.id} className={`stats-ex-pill${selEx?.id===ex.id?" on":""}`} onClick={e=>{e.stopPropagation();setSelEx(prev=>prev?.id===ex.id?null:ex);}}>{ex.name}</button>
            ))}
          </div>
          {selEx&&exData&&exData.length>=2&&(()=>{
            const col=program.find(d=>d.exercises?.find(e=>e.id===selEx.id))?.color||"var(--accent)";
            return(<>
              <MiniLineChart data={exData} color={col} height={90}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
                {miniStat("Start",`${exData[0]}kg`)}
                {miniStat("Current",`${exData[exData.length-1]}kg`)}
                <div style={{background:"var(--s2)",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:9,color:col,letterSpacing:.6,textTransform:"uppercase",marginBottom:2}}>Gain</div>
                  <div style={{fontWeight:700,fontSize:16,color:col}}>+{(Math.max(...exData)-Math.min(...exData)).toFixed(1)}kg</div>
                </div>
              </div>
            </>);
          })()}
          {selEx&&exData&&exData.length<2&&<p style={{color:"var(--muted)",fontSize:13,marginTop:8}}>Need 2+ sessions with {selEx.name}.</p>}
          {!selEx&&<p style={{color:"var(--muted)",fontSize:13}}>Tap an exercise above to see its weight progression.</p>}
        </div>}
      </div>}

      {/* Body Weight */}
      {bwData&&<div className="stats-section-card" onClick={()=>tog("bw")}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={miniIconStyle("rgba(100,150,255,.12)")}>⚖️</div>
            <div><div style={{fontWeight:700,fontSize:14}}>Body Weight</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{bwData.length} measurements</div></div>
          </div>
          <span className={`stats-expand-caret${expanded==="bw"?" open":""}`}><Ic.ChevronDown/></span>
        </div>
        {expanded!=="bw"&&<div className="stats-section-preview"><MiniLineChart data={bwData.slice(-6)} color="#C77DFF" height={44}/></div>}
        {expanded==="bw"&&<div style={{marginTop:14}} onClick={e=>e.stopPropagation()}>
          <MiniLineChart data={bwData} color="#C77DFF" height={80}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
            {miniStat("Start",`${bwData[0]}kg`)}
            {miniStat("Current",`${bwData[bwData.length-1]}kg`)}
            <div style={{background:"var(--s2)",borderRadius:8,padding:"8px 10px"}}>
              <div style={{fontSize:9,color:"var(--muted2)",letterSpacing:.6,textTransform:"uppercase",marginBottom:2}}>Change</div>
              <div style={{fontWeight:700,fontSize:16,color:(bwData[bwData.length-1]-bwData[0])<=0?"#4CAF50":"#e24b4a"}}>
                {(bwData[bwData.length-1]-bwData[0])>=0?"+":""}{(bwData[bwData.length-1]-bwData[0]).toFixed(1)}kg
              </div>
            </div>
          </div>
        </div>}
      </div>}
  </div>);
}

function StatsScreen({history,program,trackerGoals,trackerLogs,onClose}){
  const [selEx,setSelEx]=useState(null);
  const exercises=program.flatMap(d=>d.exercises||[]);
  const exOptions=exercises.filter(ex=>history.some(h=>h.exercises?.find(e=>e.id===ex.id)));
  const startDate=ls.get("gr_start",null);

  const weeklyData=(()=>{
    const weeks=[];
    for(let w=11;w>=0;w--){
      const wStart=new Date();wStart.setDate(wStart.getDate()-wStart.getDay()-w*7);wStart.setHours(0,0,0,0);
      const wEnd=new Date(wStart);wEnd.setDate(wStart.getDate()+7);
      const count=history.filter(h=>{const d=new Date(h.date);return d>=wStart&&d<wEnd&&!program.find(p=>p.id===h.dayKey)?.isRest;}).length;
      const isThisWeek=w===0;
      const label=wStart.toLocaleDateString("en",{month:"short",day:"numeric"}).slice(0,3);
      weeks.push({v:count,label:w===0?"Now":label,today:isThisWeek});
    }
    return weeks;
  })();

  const volumeData=(()=>{
    return history.slice(-20).filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).map(h=>{
      const vol=h.exercises?.reduce((s,ex)=>s+(ex.sets?.reduce((ss,st)=>ss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0)||0),0)||0;
      return vol;
    });
  })();

  const exData=selEx?(()=>{
    const sessions=history.filter(h=>h.exercises?.find(e=>e.id===selEx.id));
    return sessions.slice(-16).map(h=>{
      const ex=h.exercises?.find(e=>e.id===selEx.id);
      const maxW=Math.max(0,...(ex?.sets?.map(s=>parseFloat(s.weight)||0)||[]));
      return maxW;
    });
  })():null;

  const totalSessions=history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const totalVolume=Math.round(history.reduce((s,h)=>s+(h.exercises?.reduce((ss,ex)=>ss+(ex.sets?.reduce((sss,st)=>sss+(parseFloat(st.weight)||0)*(parseInt(st.reps)||0),0)||0),0)||0),0));
  const avgDur=totalSessions?Math.round(history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).reduce((s,h)=>s+(h.duration||0),0)/totalSessions):0;

  const bodyWeightData=(()=>{
    const bwGoal=trackerGoals?.find(g=>g.id==="weight");
    if(!bwGoal) return null;
    const pts=trackerLogs?.slice(-20).map(l=>parseFloat(l.entries?.[bwGoal.id])||null).filter(Boolean)||[];
    return pts.length>=2?pts:null;
  })();

  return(<div className="stats-overlay">
    <div className="phdr" style={{display:"flex",alignItems:"center",gap:12}}>
      <button className="btn-ghost" onClick={onClose} style={{fontSize:22,lineHeight:1}}>←</button>
      <h1>Statistics</h1>
    </div>
    <div className="scroll">
      <div className="stats-row">
        <div className="stat-card"><div className="stat-lbl">Workouts</div><div className="stat-num">{totalSessions}</div></div>
        <div className="stat-card"><div className="stat-lbl">Avg Duration</div><div className="stat-num" style={{fontSize:22}}>{avgDur}min</div></div>
        <div className="stat-card"><div className="stat-lbl">Total Volume</div><div className="stat-num" style={{fontSize:20}}>{totalVolume>999?`${(totalVolume/1000).toFixed(1)}t`:`${totalVolume}kg`}</div></div>
      </div>

      <div className="stats-chart-card">
        <div className="ctitle">WEEKLY WORKOUTS — LAST 12 WEEKS</div>
        <BarChart data={weeklyData} color="var(--accent)" height={80}/>
      </div>

      {volumeData.length>=2&&<div className="stats-chart-card">
        <div className="ctitle">VOLUME PER SESSION — LAST {volumeData.length} SESSIONS</div>
        <MiniLineChart data={volumeData} color="var(--accent)" height={80}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"var(--muted)"}}>
          <span>{Math.round(Math.min(...volumeData))}kg</span>
          <span>{Math.round(Math.max(...volumeData))}kg peak</span>
        </div>
      </div>}

      {bodyWeightData&&<div className="stats-chart-card">
        <div className="ctitle">BODY WEIGHT TREND</div>
        <MiniLineChart data={bodyWeightData} color="#C77DFF" height={70}/>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"var(--muted)"}}>
          <span>{Math.min(...bodyWeightData)}kg</span><span>{Math.max(...bodyWeightData)}kg</span>
        </div>
      </div>}

      <div className="stats-chart-card">
        <div className="ctitle" style={{marginBottom:10}}>EXERCISE PROGRESSION</div>
        {exOptions.length===0&&<p style={{color:"var(--muted)",fontSize:13}}>Complete some workouts to see progression charts.</p>}
        {exOptions.length>0&&<>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {exOptions.map(ex=>(
              <button key={ex.id} className={`stats-ex-pill ${selEx?.id===ex.id?"on":""}`} onClick={()=>setSelEx(ex.id===selEx?.id?null:ex)}>{ex.name}</button>
            ))}
          </div>
          {selEx&&exData&&exData.length>=2&&<>
            <div style={{fontSize:12,color:"var(--muted2)",marginBottom:6}}>{selEx.name} — top weight per session (kg)</div>
            <MiniLineChart data={exData} color={program.find(d=>d.exercises?.find(e=>e.id===selEx.id))?.color||"var(--accent)"} height={90}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"var(--muted)"}}>
              <span>Start: {Math.min(...exData)}kg</span>
              <span>Best: {Math.max(...exData)}kg</span>
              <span style={{color:"var(--accent2)",fontWeight:700}}>+{(Math.max(...exData)-Math.min(...exData)).toFixed(1)}kg</span>
            </div>
          </>}
          {selEx&&exData&&exData.length<2&&<p style={{color:"var(--muted)",fontSize:13,marginTop:8}}>Need at least 2 sessions with {selEx.name} to show a chart.</p>}
          {!selEx&&<p style={{color:"var(--muted)",fontSize:13}}>Tap an exercise above to see its weight progression.</p>}
        </>}
      </div>
    </div>
  </div>);
}

function WorkoutSession({workout,history,onFinish,onBack,startRest,restEnabled}){
  const startTime=useRef(Date.now());
  const initSets=(ex)=>Array.from({length:ex.sets},(_,si)=>{
    const prevSessions=history.filter(h=>h.exercises?.some(e=>e.id===ex.id));
    const lastEx=prevSessions.length?prevSessions[prevSessions.length-1].exercises?.find(e=>e.id===ex.id):null;
    const lastSet=lastEx?.sets?.[si];
    const prevLabel=lastSet&&!lastSet.skipped&&lastSet.reps?`${lastSet.weight??lastEx.weight}kg x${lastSet.reps}`:null;
    return {setType:(ex.setTypePerSet||[])[si]??"normal",targetReps:(ex.repsPerSet||[])[si]??ex.reps,targetWeight:(ex.weightPerSet||[])[si]??ex.weight,weight:String((ex.weightPerSet||[])[si]??ex.weight),reps:"",prevLabel,skipped:false,done:false};
  });
  const [exStates,setExStates]=useState(()=>workout.exercises.map(ex=>({id:ex.id,name:ex.name,weight:ex.weight,skipped:false,sets:initSets(ex)})));
  const [note,setNote]=useState("");
  const [elapsed,setElapsed]=useState(0);
  const [showFinish,setShowFinish]=useState(false);
  useEffect(()=>{const t=setInterval(()=>setElapsed(Math.floor((Date.now()-startTime.current)/1000)),1000);return()=>clearInterval(t);},[]);
  const fmtTime=(secs)=>{const h=Math.floor(secs/3600);const m=Math.floor((secs%3600)/60);const s=secs%60;const parts=[];if(h>0)parts.push(`${h}h`);if(m>0)parts.push(`${m}min`);if(s>0||parts.length===0)parts.push(`${s}sec`);return parts.join(" ");};
  const updSet=(ei,si,ch)=>setExStates(s=>s.map((ex,i)=>i!==ei?ex:{...ex,sets:ex.sets.map((st,j)=>j!==si?st:{...st,...ch})}));
  const handleCheck=(ei,si)=>{
    const s=exStates[ei].sets[si];
    if(s.skipped) return;
    const newDone=!s.done;
    const repsToSave=(!s.reps||s.reps==="")&&newDone?String(s.targetReps):s.reps;
    updSet(ei,si,{done:newDone,reps:repsToSave});
    if(newDone&&restEnabled){
      const ex=workout.exercises[ei];
      const isLastSet=si===ex.sets-1;
      const isLastEx=ei===workout.exercises.length-1;
      if(!(isLastSet&&isLastEx)){const restSecs=(ex.restPerSet&&ex.restPerSet[si]!=null)?ex.restPerSet[si]:(ex.rest??120);startRest(restSecs);}
    }
  };
  const allDone=exStates.every(ex=>ex.skipped||ex.sets.every(st=>st.skipped||st.done));
  const incompleteSets=exStates.flatMap((exState,ei)=>
    exState.skipped?[]:
    exState.sets.map((st,si)=>({exName:exState.name,si,st,ei})).filter(({st})=>!st.skipped&&!st.done)
  );
  const doFinish=()=>{const duration=Math.round((Date.now()-startTime.current)/60000);onFinish({date:new Date().toISOString(),dayKey:workout.id,duration,note,exercises:exStates});};
  const handleFinishClick=()=>{
    if(incompleteSets.length>0){setShowFinish(true);}else{doFinish();}
  };
  return(<div style={{display:"flex",flexDirection:"column",minHeight:"100svh"}}>
    <div className="w-header">
      <button className="back-btn" onClick={onBack}><Ic.Back/></button>
      <div style={{flex:1}}><div style={{fontWeight:800,fontSize:17,letterSpacing:-.3}}>{workout.label}</div><div style={{fontSize:12,color:"var(--muted)"}}>{exStates.filter(e=>!e.skipped).length} exercises</div></div>
      <button className="finish-btn" style={{width:"auto",margin:0,padding:"8px 18px",fontSize:14,letterSpacing:0}} onClick={handleFinishClick}>{allDone?"Done":"Finish"}</button>
    </div>
    <WorkoutStats exStates={exStates} elapsed={elapsed} fmtTime={fmtTime}/>
    <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
      {exStates.map((exState,ei)=>{
        const ex=workout.exercises[ei];
        const eh=history.flatMap(h=>h.exercises?.filter(e=>e.id===ex.id)??[]);
        const pg=getProgression(eh,ex.reps,exState.weight);
        const allSD=exState.sets.every(st=>st.skipped||st.done);
        return(<div key={ex.id}>
          {pg&&!exState.skipped&&<div className={`ai-banner ${pg.type==="increase"?"good":""}`}>{pg.type==="increase"?`Hit all reps 2x! Try ${(exState.weight+pg.amount).toFixed(2)}kg (+${pg.amount}kg)`:`Struggled last session - stay at ${exState.weight}kg`}</div>}
          <div className={`ex-card ${exState.skipped?"ex-skip":allSD?"ex-done":""}`}>
            <div className="ex-chead">
              <div><div className="ex-cname">{ex.name}</div><div className="ex-cmeta">{exState.sets.filter(s=>!s.skipped&&(s.setType==="normal"||s.setType==="drop")).length} working sets</div></div>
              <button className="btn-ghost" onClick={()=>setExStates(s=>s.map((e,i)=>i!==ei?e:{...e,skipped:!e.skipped}))}>{exState.skipped?"Restore":"Skip"}</button>
            </div>
            {!exState.skipped&&(
              <ExerciseSetTable ex={ex} sets={exState.sets} editable={true}
                onTypeSelect={(si,t)=>updSet(ei,si,{setType:t})}
                onWeightChange={(si,val)=>updSet(ei,si,{weight:val})}
                onRepsChange={(si,val)=>{const n=parseInt(val);updSet(ei,si,{reps:val,done:!isNaN(n)&&n>0});}}
                onFieldBlur={(si)=>{const r=parseInt(exState.sets[si].reps);const isLastSet=si===exState.sets.length-1;const isLastEx=ei===workout.exercises.length-1;if(!isNaN(r)&&r>0&&restEnabled&&!(isLastSet&&isLastEx)){const restSecs=(ex.restPerSet&&ex.restPerSet[si]!=null)?ex.restPerSet[si]:(ex.rest??120);startRest(restSecs);}}}
                onCheck={(si)=>handleCheck(ei,si)}
                onSkip={(si)=>updSet(ei,si,{skipped:!exState.sets[si].skipped,done:false,reps:""})}
                onAddSet={()=>setExStates(s=>s.map((exSt,i)=>{if(i!==ei)return exSt;const last=exSt.sets[exSt.sets.length-1];return{...exSt,sets:[...exSt.sets,{...last,reps:"",done:false,skipped:false}]};}))}
              />
            )}
          </div>
        </div>);
      })}
      <button className="finish-btn" onClick={handleFinishClick}>{allDone?"FINISH WORKOUT":"FINISH WORKOUT (EARLY)"}</button>
    </div>

    {showFinish&&(
      <div className="finish-modal-overlay" onClick={()=>setShowFinish(false)}>
        <div className="finish-modal" onClick={e=>e.stopPropagation()}>
          <div style={{fontWeight:800,fontSize:20,letterSpacing:-0.3,marginBottom:4}}>Finish workout?</div>
          {incompleteSets.length>0&&<>
            <div style={{fontSize:13,color:"var(--muted2)",marginBottom:12}}>You have {incompleteSets.length} unchecked set{incompleteSets.length>1?"s":""}:</div>
            <div style={{marginBottom:14,maxHeight:160,overflowY:"auto"}}>
              {incompleteSets.map(({exName,si,ei},k)=>(
                <div key={k} className="incomplete-set">
                  <div style={{width:24,height:24,borderRadius:6,background:"var(--s3)",border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"var(--muted2)",flexShrink:0}}>
                    {si+1}
                  </div>
                  <span>{exName}</span>
                </div>
              ))}
            </div>
          </>}
          <div style={{marginBottom:16}}>
            <div className="note-lbl">Session note</div>
            <textarea className="note-ta" placeholder="How did it feel? Any notes..." value={note} onChange={e=>setNote(e.target.value)} style={{minHeight:72}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn-ghost" style={{flex:1,padding:12}} onClick={()=>setShowFinish(false)}>Keep training</button>
            <button className="finish-btn" style={{flex:2,display:"block",width:"auto",margin:0,padding:12}} onClick={doFinish}>Finish anyway</button>
          </div>
        </div>
      </div>
    )}
  </div>);
}

function HistoryDetail({session,program,onBack,onDelete}){
  const day=program.find(d=>d.id===session.dayKey);
  return(<div style={{display:"flex",flexDirection:"column",minHeight:"100svh"}}>
    <div className="w-header">
      <button className="back-btn" onClick={onBack}><Ic.Back/></button>
      <div style={{flex:1}}>
        <div style={{fontWeight:800,fontSize:17,letterSpacing:-.3,color:day?.color??undefined}}>{day?.label??session.dayKey}</div>
        <div style={{fontSize:12,color:"var(--muted)"}}>{new Date(session.date).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} &bull; {session.duration}min</div>
      </div>
      {onDelete&&<button className="btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>{if(window.confirm("Delete this session?"))onDelete();}}>Delete</button>}
    </div>
    <div style={{flex:1,overflowY:"auto",paddingBottom:80}}>
      {session.exercises?.filter(e=>!e.skipped).map((exState,ei)=>(
        <div key={ei} className="ex-card" style={{margin:"12px 14px"}}>
          <div className="ex-chead">
            <div><div className="ex-cname">{exState.name}</div><div className="ex-cmeta">{exState.sets?.filter(s=>!s.skipped&&s.setType==="normal").length??exState.sets?.filter(s=>!s.skipped).length} sets</div></div>
          </div>
          <ExerciseSetTable ex={exState} sets={(exState.sets??[]).map(s=>({...s,weight:s.weight??exState.weight,prevLabel:null,done:true}))} editable={false}/>
        </div>
      ))}
      {session.note&&<div style={{margin:"0 14px 14px",padding:"10px 13px",background:"var(--s2)",borderRadius:10,fontSize:13,color:"var(--muted2)",fontStyle:"italic"}}>&ldquo;{session.note}&rdquo;</div>}
    </div>
  </div>);
}

function computeProgramDiff(current,proposed){
  const changes=[];
  for(const curDay of current){
    const propDay=proposed.find(d=>d.id===curDay.id);
    if(!propDay){changes.push({type:"day_removed",label:curDay.label});continue;}
    if(propDay.label!==curDay.label) changes.push({type:"day_renamed",from:curDay.label,to:propDay.label});
    for(const curEx of curDay.exercises){
      const propEx=propDay.exercises.find(e=>e.id===curEx.id);
      if(!propEx){
        changes.push({type:"ex_removed",day:propDay.label,name:curEx.name});
      }else{
        const diffs=[];
        if(propEx.sets!==curEx.sets) diffs.push(`sets: ${curEx.sets}→${propEx.sets}`);
        if(propEx.reps!==curEx.reps) diffs.push(`reps: ${curEx.reps}→${propEx.reps}`);
        if(Number(propEx.weight)!==Number(curEx.weight)) diffs.push(`weight: ${curEx.weight}→${propEx.weight}kg`);
        if(propEx.rest!=null&&curEx.rest!=null&&propEx.rest!==curEx.rest) diffs.push(`rest: ${curEx.rest}→${propEx.rest}s`);
        if(propEx.name!==curEx.name) diffs.push(`renamed to "${propEx.name}"`);
        if(diffs.length>0) changes.push({type:"ex_modified",day:propDay.label,name:curEx.name,diffs});
      }
    }
    for(const propEx of propDay.exercises){
      if(!curDay.exercises.find(e=>e.id===propEx.id))
        changes.push({type:"ex_added",day:propDay.label,name:propEx.name,detail:`${propEx.sets}x${propEx.reps} @ ${propEx.weight}kg`});
    }
  }
  for(const propDay of proposed){
    if(!current.find(d=>d.id===propDay.id))
      changes.push({type:"day_added",label:propDay.label});
  }
  return changes;
}

function BoldText({text}){
  const parts=(text??"").split(/(\*\*[^*]+\*\*)/g);
  return<>{parts.map((p,i)=>p.startsWith("**")&&p.endsWith("**")?<strong key={i}>{p.slice(2,-2)}</strong>:<span key={i}>{p}</span>)}</>;
}
function RenderMessage({text}){
  const lines=(text??"").split("\n");
  return<span style={{display:"block"}}>{lines.map((line,i)=>{
    const t=line.trim();
    if(t.startsWith("- ")||t.startsWith("• ")){
      const c=t.slice(2);
      return<span key={i} style={{display:"block",paddingLeft:14,position:"relative",marginTop:2}}>
        <span style={{position:"absolute",left:2,color:"var(--accent2)"}}>•</span><BoldText text={c}/>
      </span>;
    }
    return<span key={i}>{i>0&&<br/>}<BoldText text={line}/></span>;
  })}</span>;
}

const STATIC_PROMPTS=["How am I progressing?","Suggest a program tweak","What should I focus on?","Am I overtraining?"];
function getSmartPrompts(history,streak,trackerLogs,totalSessions){
  const prompts=[];
  if(streak>=5) prompts.push("How do I maintain my streak?");
  else if(streak===0) prompts.push("Help me get back on track");
  else prompts.push("How am I progressing?");
  if(totalSessions>=10) prompts.push("Am I overtraining?");
  else prompts.push("What should I focus on first?");
  const last=history.slice(-3);
  if(last.length>=3) prompts.push("Analyze my last 3 sessions");
  else prompts.push("Suggest a beginner plan");
  if(trackerLogs?.length>=3) prompts.push("Review my nutrition this week");
  else prompts.push("How should I eat for my goals?");
  return prompts;
}

function TrainerChat({history,program,user,chatSessions,onSessionsChange,onProgramChange,trackerGoals,trackerLogs,meals,streak,totalSessions}){
  function nowT(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
  const sessionId=useRef(Date.now().toString());
  const makeGreeting=()=>({role:"ai",text:`Hey ${user?.name?.split(" ")[0]??"there"}! I'm your personal trainer. I know all your workout data. Ask me anything!`,time:nowT()});
  const [msgs,setMsgs]=useState([makeGreeting()]);
  const sessions=chatSessions;
  const setSessions=onSessionsChange;
  const [view,setView]=useState("chat");
  const [viewingId,setViewingId]=useState(null);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [loadingPhase,setLoadingPhase]=useState(null);
  const [editingIdx,setEditingIdx]=useState(null);
  const [editingText,setEditingText]=useState("");
  const [pastInput,setPastInput]=useState("");
  const [copiedIdx,setCopiedIdx]=useState(null);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);

  const newChat=()=>{sessionId.current=Date.now().toString();setMsgs([makeGreeting()]);setInput("");setEditingIdx(null);};

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  useEffect(()=>{
    if(msgs.filter(m=>m.role==="user").length===0)return;
    const title=msgs.find(m=>m.role==="user")?.text?.slice(0,60)??"Chat";
    setSessions(prev=>{
      const existing=prev.find(s=>s.id===sessionId.current);
      const session={id:sessionId.current,date:new Date().toISOString(),title,msgs,...(existing?.nextId?{nextId:existing.nextId}:{})};
      return[session,...prev.filter(s=>s.id!==sessionId.current)].slice(0,50);
    });
  },[msgs]);

  const acceptProposal=(msgIdx)=>{
    const msg=msgs[msgIdx];
    if(!msg?.proposal||msg.proposal.status!=="pending")return;
    onProgramChange(msg.proposal.program);
    setMsgs(m=>m.map((x,i)=>i===msgIdx?{...x,proposal:{...x.proposal,status:"accepted"}}:x));
  };
  const dismissProposal=(msgIdx)=>{
    setMsgs(m=>m.map((x,i)=>i===msgIdx?{...x,proposal:{...x.proposal,status:"dismissed"}}:x));
  };
  const copyMsg=(idx,text)=>{
    navigator.clipboard?.writeText(text).catch(()=>{});
    setCopiedIdx(idx);
    setTimeout(()=>setCopiedIdx(i=>i===idx?null:i),2000);
  };
  const shareMsg=(text)=>{
    if(navigator.share){navigator.share({text}).catch(()=>{});}
    else{navigator.clipboard?.writeText(text).catch(()=>{});}
  };
  const regenerate=()=>{
    const lastAiIdx=[...msgs].map((m,i)=>m.role==="ai"?i:-1).filter(i=>i>=0).pop();
    if(lastAiIdx===undefined||lastAiIdx<0)return;
    const lastUserIdx=[...msgs].slice(0,lastAiIdx).map((m,i)=>m.role==="user"?i:-1).filter(i=>i>=0).pop();
    if(lastUserIdx===undefined||lastUserIdx<0)return;
    const userMsg=msgs[lastUserIdx];
    const msgsBeforeUser=msgs.slice(0,lastUserIdx);
    setMsgs([...msgsBeforeUser,{role:"user",text:userMsg.text,time:userMsg.time}]);
    send(userMsg.text,msgsBeforeUser);
  };
  const submitEdit=(idx)=>{
    const newText=editingText.trim();
    if(!newText){setEditingIdx(null);return;}
    const msgsUpToEdit=msgs.slice(0,idx);
    setEditingIdx(null);
    setMsgs([...msgsUpToEdit,{role:"user",text:newText,time:nowT()}]);
    send(newText,msgsUpToEdit);
  };

  const send=async(textOverride,msgHistoryOverride)=>{
    const text=(textOverride??input).trim();
    if(!text||loading)return;
    if(!textOverride)setInput("");
    if(!msgHistoryOverride)setMsgs(m=>[...m,{role:"user",text,time:nowT()}]);
    setLoading(true);
    const firstName=user?.name?.split(" ")[0]??"there";
    const apiBase=import.meta.env.VITE_API_URL??"";

    const callAPI=async(systemPrompt,messages,maxTokens=800)=>{
      const r=await fetch(`${apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemPrompt,messages,maxTokens})});
      return r.json();
    };

    const dataBuilders={
      streak:()=>`Streak: ${streak??0} days | Best streak: ${calcBestStreak(history,program)} days | Total sessions: ${totalSessions??0}`,
      program:()=>`Program:\n${JSON.stringify(program.map(d=>({id:d.id,label:d.label,isRest:d.isRest,exercises:d.exercises.map(e=>({id:e.id,name:e.name,sets:e.sets,reps:e.reps,weight:e.weight}))})))}`,
      history:()=>`Recent sessions:\n${history.slice(-8).map(s=>`${s.date?.slice(0,10)} ${s.dayKey} ${s.duration??0}min: ${s.exercises?.slice(0,6).map(e=>`${e.name} ${e.weight??0}kg`).join(", ")||"(no data)"}`).join("\n")||"None yet."}`,
      progression:()=>{
        const lines=program.flatMap(d=>d.exercises||[]).map(ex=>{
          const exH=history.flatMap(h=>h.exercises?.filter(e=>e.id===ex.id)??[]);
          if(!exH.length)return null;
          const maxW=Math.max(...exH.flatMap(e=>e.sets?.map(s=>parseFloat(s.weight||0)||0)));
          return`${ex.name}: ${exH[exH.length-1].sets?.[0]?.weight??ex.weight}kg current, PB ${maxW}kg (${exH.length} sessions)`;
        }).filter(Boolean);
        return`Progression:\n${lines.join("\n")||"No progression data yet."}`;
      },
      tracker:()=>{
        const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
        const lines=days.map(date=>{
          const ent=(trackerLogs||[]).find(l=>l.date===date)?.entries||{};
          const parts=Object.entries(ent).filter(([k])=>k!=="logged_meals").map(([id,val])=>{const g=(trackerGoals||[]).find(x=>x.id===id);return`${g?.name??id}:${val}${g?.unit?` ${g.unit}`:""}`;});
          return parts.length?`${date}: ${parts.join(", ")}`:null;
        }).filter(Boolean);
        return lines.length?`Health tracking:\n${lines.join("\n")}`:"No recent tracking data.";
      },
    };

    try{
      // Route: keyword-based context selection (instant, no API call)
      const t2=text.toLowerCase();
      const isProgramEdit=/\b(change|update|modify|add|remove|replace|adjust|switch|restructure)\b.*(program|plan|workout|day|exercise|split)|program.*(change|update|edit)/.test(t2);
      const needs=new Set();
      if(isProgramEdit||/\b(program|plan|schedule|split|day|routine|exercise)\b/.test(t2)) needs.add("program");
      if(/\b(streak|days|consistent|row|run|kept up)\b/.test(t2)) needs.add("streak");
      if(/\b(history|last|recent|yesterday|session|did i|trained)\b/.test(t2)) needs.add("history");
      if(/\b(progress|stronger|weight|heavier|pb|personal best|improve|lift|max)\b/.test(t2)) needs.add("progression");
      if(/\b(eat|food|calorie|cal|nutrition|macro|protein|carb|fat|water|track|diet|meal)\b/.test(t2)) needs.add("tracker");
      if(!needs.size){needs.add("streak");needs.add("history");}
      if(isProgramEdit)needs.add("program");
      const needsArr=[...needs];

      // Gather only the routed data and get the answer
      const ctx=needsArr.map(k=>dataBuilders[k]?.()).filter(Boolean).join("\n\n");
      const programEditInstructions=isProgramEdit?`

IMPORTANT: This is a program modification request. You MUST respond in exactly this format and no other:
1. Write exactly 1-2 sentences summarising what you changed.
2. Immediately output the complete updated program as JSON inside the tags below. Do NOT write a list of exercises. Do NOT explain each change. Only the JSON inside the tags will actually update the user's program in the app.

<PROGRAM_UPDATE>
[paste the complete modified program JSON array here, preserving ALL days including rest days, with the same structure: id, label, isRest, exercises with id/name/sets/reps/weight]
</PROGRAM_UPDATE>`:"";
      const answerPrompt=`You are GRIND, a personal trainer AI for ${firstName}. Be direct, specific, and data-driven. **Bold** key numbers. Keep replies concise (3-5 sentences unless analysis is requested).${programEditInstructions}

${ctx}`;

      const contextMsgs=msgHistoryOverride??msgs;
      const ad=await callAPI(answerPrompt,[...contextMsgs.slice(1),{role:"user",text}],1200);
      let reply=ad.reply??(ad.error?`Error: ${ad.error}`:"Connection error.");
      let proposalData=null;
      const match=reply.match(/<PROGRAM_UPDATE>([\s\S]*?)<\/PROGRAM_UPDATE>/);
      if(match){
        try{
          const proposedProg=JSON.parse(match[1].trim());
          const changes=computeProgramDiff(program,proposedProg);
          if(changes.length>0)proposalData={program:proposedProg,changes,status:"pending"};
        }catch(e){console.error("[chat] proposal parse:",e);}
        reply=reply.replace(/<PROGRAM_UPDATE>[\s\S]*?<\/PROGRAM_UPDATE>/,"").trim();
      }
      setMsgs(m=>[...m,{role:"ai",text:reply,time:nowT(),...(proposalData?{proposal:proposalData}:{})}]);
    }catch(e){
      console.error("[chat] error:",e);
      setMsgs(m=>[...m,{role:"ai",text:"Connection error. Please try again.",time:nowT()}]);
    }
    setLoading(false); setLoadingPhase(null);
  };

  const deleteSession=(id)=>{setSessions(prev=>prev.filter(s=>s.id!==id));if(viewingId===id)setView("history");};

  if(view==="history"){
    const past=sessions.filter(s=>s.id!==sessionId.current);
    return(
      <div className="chat-wrap">
        <div className="phdr" style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="btn-ghost" onClick={()=>setView("chat")} style={{fontSize:22,lineHeight:1}}>←</button>
          <h1>Past Chats</h1>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
          {past.length===0&&<p style={{color:"var(--muted)",textAlign:"center",marginTop:40}}>No past chats yet.</p>}
          {past.map(s=>(
            <div key={s.id} className="card" style={{cursor:"pointer",marginBottom:10,padding:"12px 14px",position:"relative"}} onClick={()=>{setViewingId(s.id);setPastInput("");setView("past");}}>
              <div style={{fontWeight:600,fontSize:14,marginBottom:3,paddingRight:32,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.title}</div>
              <div style={{fontSize:12,color:"var(--muted)"}}>{new Date(s.date).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"})}</div>
              <button onClick={e=>{e.stopPropagation();deleteSession(s.id);}} style={{position:"absolute",top:"50%",right:12,transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",padding:4,borderRadius:6,opacity:.6}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=.6}><Ic.Trash/></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if(view==="past"){
    const past=sessions.find(s=>s.id===viewingId);
    const prevSession=sessions.find(s=>s.nextId===viewingId);
    const nextSession=past?.nextId?sessions.find(s=>s.id===past.nextId):null;
    const sendFromPast=()=>{
      const text=pastInput.trim();
      if(!text||!past)return;
      setPastInput("");
      const userMsg={role:"user",text,time:nowT()};
      sessionId.current=past.id;
      setMsgs([...past.msgs,userMsg]);
      setView("chat");
      send(text,past.msgs);
    };
    return(
      <div className="chat-wrap">
        <div className="phdr" style={{display:"flex",alignItems:"center",gap:10}}>
          <button className="btn-ghost" onClick={()=>setView("history")} style={{fontSize:22,lineHeight:1}}>←</button>
          <div style={{flex:1,minWidth:0}}>
            <h1 style={{fontSize:18,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{past?.title?.slice(0,40)??"Chat"}</h1>
            {past?.date&&<p style={{fontSize:11,marginTop:1}}>{new Date(past.date).toLocaleDateString([],{weekday:"long",month:"short",day:"numeric"})}</p>}
          </div>
          {(prevSession||nextSession)&&(
            <div style={{display:"flex",gap:4,flexShrink:0}}>
              <button onClick={()=>prevSession&&setViewingId(prevSession.id)} style={{background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:8,width:30,height:30,cursor:prevSession?"pointer":"default",color:prevSession?"var(--muted2)":"var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,lineHeight:1}}>‹</button>
              <button onClick={()=>nextSession&&setViewingId(nextSession.id)} style={{background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:8,width:30,height:30,cursor:nextSession?"pointer":"default",color:nextSession?"var(--muted2)":"var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,lineHeight:1}}>›</button>
            </div>
          )}
        </div>
        <div className="chat-msgs" style={{flex:1}}>
          {(past?.msgs??[]).map((m,i)=>(
            <div key={i} className={`msg ${m.role}`}>
              {m.role==="ai"
                ?<div className="msg-row"><div className="ai-avatar">AI</div><div><div className="bubble"><RenderMessage text={m.text}/></div><div className="msg-time">{m.time}</div></div></div>
                :<><div className="bubble">{m.text}</div><div className="msg-time" style={{textAlign:"right"}}>{m.time}</div></>
              }
            </div>
          ))}
        </div>
        <div className="past-chat-bar">
          <input className="chat-in" type="text" value={pastInput} onChange={e=>setPastInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendFromPast()} placeholder="Continue this chat..." autoComplete="off" autoCorrect="off" spellCheck="false"/>
          <button className="send-btn" onClick={sendFromPast}><Ic.Send/></button>
        </div>
      </div>
    );
  }

  const hasUserMsg=msgs.some(m=>m.role==="user");

  return(
    <div className="chat-wrap">
      <div className="phdr" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h1>Trainer</h1>
          <p style={{fontSize:12,marginTop:2}}>AI-powered • knows your full history</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          {msgs.some(m=>m.role==="user")&&<button className="btn-ghost" onClick={newChat} style={{fontSize:13}}>New chat</button>}
          <button className="btn-ghost" onClick={()=>setView("history")} style={{fontSize:13}}>History</button>
        </div>
      </div>

      {!hasUserMsg?(
        <div className="chat-empty">
          <div className="chat-empty-avatar">AI</div>
          <div>
            <div className="chat-empty-title">Hey {user?.name?.split(" ")[0]??"there"}!</div>
            <div className="chat-empty-sub">I know your workout history, progression, and health data. Ask me anything.</div>
          </div>
          {(()=>{
            const todayStr=new Date().toISOString().slice(0,10);
            const lastSess=[...(history||[])].reverse().find(h=>h.date!==todayStr)||[...(history||[])].reverse()[0];
            const lastSessLabel=lastSess?new Date(lastSess.date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):null;
            const todayLog=(trackerLogs||[]).find(l=>l.date===todayStr)||{entries:{}};
            const tEnt=todayLog.entries||{};
            const tMealIds=Array.isArray(tEnt.logged_meals)?tEnt.logged_meals:[];
            const todayCal=Math.round((parseFloat(tEnt.calories)||0)+tMealIds.reduce((s,mid)=>s+((meals||[]).find(m=>m.id===mid)?.calories||0),0));
            const chips=[
              streak>0&&{label:`🔥 ${streak} day streak`,color:"var(--accent2)"},
              lastSessLabel&&{label:`Last session: ${lastSessLabel}`,color:"var(--muted2)"},
              todayCal>0&&{label:`Today: ${todayCal} kcal`,color:"var(--muted2)"},
            ].filter(Boolean);
            if(!chips.length) return null;
            return(<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginTop:4}}>
              {chips.map((c,i)=><span key={i} style={{fontSize:11,background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:20,padding:"4px 10px",color:c.color,fontWeight:600}}>{c.label}</span>)}
            </div>);
          })()}
          <div className="quick-chips">
            {getSmartPrompts(history,streak,trackerLogs,totalSessions).map(q=>(
              <button key={q} className="quick-chip" onClick={()=>send(q)}>{q}</button>
            ))}
          </div>
        </div>
      ):(
        <div className="chat-msgs">
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"contents"}}>
              {m.role==="ai"?(
                <div className="msg ai">
                  <div className="msg-row">
                    <div className="ai-avatar">AI</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="bubble"><RenderMessage text={m.text}/></div>
                      <div className="msg-time">{m.time}</div>
                      <div className="msg-actions">
                        <button className={`msg-action-btn${copiedIdx===i?" copied":""}`} onClick={e=>{e.stopPropagation();copyMsg(i,m.text);}}><Ic.Copy/>{copiedIdx===i&&<span>Copied</span>}</button>
                        {!msgs.slice(i+1).some(x=>x.role==="ai")&&!loading&&<button className="msg-action-btn" onClick={e=>{e.stopPropagation();regenerate();}}><Ic.Refresh/>Regen</button>}
                        <button className="msg-action-btn" onClick={e=>{e.stopPropagation();shareMsg(m.text);}}><Ic.Share/></button>
                      </div>
                    </div>
                  </div>
                </div>
              ):(
                <div className="msg user">
                  {editingIdx===i?(
                    <div className="editing-bubble">
                      <textarea className="editing-input" value={editingText} onChange={e=>setEditingText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitEdit(i);}if(e.key==="Escape")setEditingIdx(null);}} rows={3} autoFocus/>
                      <div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end"}}>
                        <button className="btn-ghost" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setEditingIdx(null)}>Cancel</button>
                        <button className="btn-accent" style={{padding:"5px 16px",fontSize:12,width:"auto"}} onClick={()=>submitEdit(i)}>Send</button>
                      </div>
                    </div>
                  ):(
                    <>
                      <div className="bubble">{m.text}</div>
                      <div className="msg-actions">
                        <button className={`msg-action-btn${copiedIdx===i?" copied":""}`} onClick={e=>{e.stopPropagation();copyMsg(i,m.text);}}><Ic.Copy/></button>
                        {!loading&&<button className="msg-action-btn" onClick={e=>{e.stopPropagation();setEditingIdx(i);setEditingText(m.text);}}><Ic.Edit/></button>}
                        <button className="msg-action-btn" onClick={e=>{e.stopPropagation();shareMsg(m.text);}}><Ic.Share/></button>
                      </div>
                      <div className="msg-time" style={{textAlign:"right"}}>{m.time}</div>
                    </>
                  )}
                </div>
              )}
              {m.proposal&&(
                <div className="proposal-card">
                  <div className="proposal-title">PROGRAM PROPOSAL</div>
                  <div>
                    {m.proposal.changes.map((c,ci)=>{
                      if(c.type==="ex_modified") return(<div key={ci} className="proposal-change"><span style={{color:"var(--muted2)",fontSize:11}}>{c.day} — </span><span style={{fontWeight:600}}>{c.name}</span><span style={{color:"var(--muted)",marginLeft:6,fontSize:11}}>{c.diffs.join(", ")}</span></div>);
                      if(c.type==="ex_added") return(<div key={ci} className="proposal-change"><span style={{color:"var(--muted2)",fontSize:11}}>{c.day} — </span><span style={{color:"#88cc88"}}>+ {c.name}</span><span style={{color:"var(--muted)",marginLeft:6,fontSize:11}}>{c.detail}</span></div>);
                      if(c.type==="ex_removed") return(<div key={ci} className="proposal-change"><span style={{color:"var(--muted2)",fontSize:11}}>{c.day} — </span><span style={{color:"#e24b4a"}}>- {c.name}</span></div>);
                      if(c.type==="day_added") return(<div key={ci} className="proposal-change"><span style={{color:"#88cc88"}}>+ New day: {c.label}</span></div>);
                      if(c.type==="day_removed") return(<div key={ci} className="proposal-change"><span style={{color:"#e24b4a"}}>- Removed: {c.label}</span></div>);
                      if(c.type==="day_renamed") return(<div key={ci} className="proposal-change"><span style={{color:"var(--accent2)"}}>{c.from} → {c.to}</span></div>);
                      return null;
                    })}
                  </div>
                  {m.proposal.status==="pending"&&(
                    <div className="proposal-btns">
                      <button className="proposal-accept" onClick={()=>acceptProposal(i)}>Apply changes</button>
                      <button className="proposal-dismiss" onClick={()=>dismissProposal(i)}>Dismiss</button>
                    </div>
                  )}
                  {m.proposal.status==="accepted"&&<div style={{marginTop:10,color:"#88cc88",fontSize:13}}>✓ Applied to your program</div>}
                  {m.proposal.status==="dismissed"&&<div style={{marginTop:10,color:"var(--muted)",fontSize:12}}>Dismissed</div>}
                </div>
              )}
            </div>
          ))}
          {loading&&(
            <div className="msg ai">
              <div className="msg-row">
                <div className="ai-avatar">AI</div>
                <div className="bubble"><div className="typing"><div className="dot"/><div className="dot"/><div className="dot"/></div></div>
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      )}

      <div className="chat-bar">
        <input
          ref={inputRef}
          className="chat-in"
          type="text"
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
          placeholder="Ask your trainer..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        <button className="send-btn" onClick={send}><Ic.Send/></button>
      </div>
    </div>
  );
}

function BigCalendar({ mode, program, history, startDate, trackerGoals, trackerLogs, onClose, onSessionClick }) {
  const [monthDate, setMonthDate] = useState(()=>{ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1); });
  const [activeCat, setActiveCat] = useState("All");
  const [dayDetail, setDayDetail] = useState(null);

  const today = new Date(); today.setHours(0,0,0,0);
  const year = monthDate.getFullYear();
  const mo = monthDate.getMonth();
  const firstDow = (new Date(year,mo,1).getDay()+6)%7;
  const daysInMonth = new Date(year,mo+1,0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>new Date(year,mo,i+1))];
  const monthLabel = monthDate.toLocaleDateString("en-GB",{month:"long",year:"numeric"}).toUpperCase();

  const cats = mode==="tracker"
    ? ["All","Food","Supplements","Body",...(trackerGoals??[]).map(g=>g.category).filter(c=>c&&!["Food","Supplements","Body"].includes(c)).filter((c,i,a)=>a.indexOf(c)===i)]
    : [];
  const filteredGoals = activeCat==="All" ? (trackerGoals??[]) : (trackerGoals??[]).filter(g=>g.category===activeCat);

  const streakCount = (()=>{
    if(mode!=="streak"||!startDate) return 0;
    let s=0; const d=new Date(); d.setHours(0,0,0,0);
    for(let i=0;i<365;i++){
      const st=getDayStatus(d,program,history,startDate);
      if(st==="rest"){d.setDate(d.getDate()-1);continue;}
      if(st==="done"||st==="partial"){s++;d.setDate(d.getDate()-1);}
      else break;
    }
    return s;
  })();

  return (
    <div className="big-cal">
      <div className="big-cal-head">
        <button className="back-btn" onClick={onClose}><Ic.Back/></button>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:18,letterSpacing:-.3}}>
            {mode==="streak"?"Streak History":mode==="workout"?"Workout Calendar":"Tracker History"}
          </div>
          {mode==="streak"&&<div style={{fontSize:12,color:"var(--muted2)",marginTop:2}}>🔥 {streakCount} day streak</div>}
        </div>
      </div>

      {mode==="tracker"&&cats.length>1&&(
        <div className="cat-bar">
          {cats.map(c=><button key={c} className={`cat-pill ${activeCat===c?"on":""}`} onClick={()=>{setActiveCat(c);setDayDetail(null);}}>{c}</button>)}
        </div>
      )}

      <div style={{flex:1,overflowY:"auto",padding:"0 14px 100px"}}>
        <div className="big-cal-nav">
          <button className="big-cal-nav-btn" onClick={()=>setMonthDate(m=>new Date(m.getFullYear(),m.getMonth()-1,1))}>‹</button>
          <div style={{fontWeight:700,fontSize:16,letterSpacing:0}}>{monthLabel}</div>
          <button className="big-cal-nav-btn" onClick={()=>setMonthDate(m=>new Date(m.getFullYear(),m.getMonth()+1,1))}>›</button>
        </div>

        <div className="big-cal-grid">
          {["M","T","W","T","F","S","S"].map((d,i)=><div key={i} className="big-cal-dow">{d}</div>)}
          {cells.map((date,i)=>{
            if(!date) return <div key={i}/>;
            const isToday=date.toDateString()===today.toDateString();
            const isFuture=date>today;

            if(mode==="streak"||mode==="workout"){
              const status=startDate?getDayStatus(date,program,history,startDate):"future";
              const dotColor=status==="done"?"#4CAF50":status==="partial"?"#f59e0b":status==="missed"&&!isFuture?"#dc3232":null;
              const bg=status==="done"?"rgba(76,175,80,.12)":status==="partial"?"rgba(245,158,11,.1)":status==="missed"&&!isFuture?"rgba(200,50,50,.08)":"transparent";
              const sessions=history.filter(h=>new Date(h.date).toDateString()===date.toDateString());
              return(
                <div key={i} className={`big-cal-day${isToday?" today":""}${mode==="workout"&&sessions.length?" clickable":""}`}
                  style={{background:bg,borderColor:isToday?"var(--accent)":status==="done"?"#4CAF5033":status==="missed"&&!isFuture?"#dc323233":"var(--border)"}}
                  onClick={()=>mode==="workout"&&sessions.length&&onSessionClick(sessions[0])}>
                  <div style={{fontSize:12,color:isToday?"var(--accent)":isFuture?"var(--muted)":"var(--text)",fontWeight:isToday?700:400}}>{date.getDate()}</div>
                  {dotColor&&<div style={{width:5,height:5,borderRadius:"50%",background:dotColor}}/>}
                </div>
              );
            }

            const dateStr=date.toISOString().slice(0,10);
            const log=trackerLogs?.find(l=>l.date===dateStr);
            const loggedGoals=filteredGoals.filter(g=>log?.entries[g.id]!==null&&log?.entries[g.id]!==undefined);
            const hasData=loggedGoals.length>0;
            const isSelected=dayDetail?.dateStr===dateStr;
            return(
              <div key={i} className={`big-cal-day${isToday?" today":""}${hasData?" clickable":""}`}
                style={{background:isSelected?"rgba(124,58,237,.2)":hasData?"rgba(124,58,237,.07)":"transparent",borderColor:isSelected?"var(--accent)":isToday?"var(--accent)":"var(--border)"}}
                onClick={()=>hasData&&setDayDetail(isSelected?null:{date,log,dateStr})}>
                <div style={{fontSize:12,color:isToday?"var(--accent)":isFuture?"var(--muted)":"var(--text)",fontWeight:isToday?700:400}}>{date.getDate()}</div>
                {hasData&&<div style={{display:"flex",gap:2,flexWrap:"wrap",justifyContent:"center",maxWidth:28}}>
                  {loggedGoals.slice(0,4).map(g=><div key={g.id} style={{width:4,height:4,borderRadius:"50%",background:g.color}}/>)}
                </div>}
              </div>
            );
          })}
        </div>

        {mode==="streak"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:20}}>
            <div className="stat-card"><div className="stat-lbl">Current Streak</div><div className="stat-num" style={{color:"var(--accent)"}}>{streakCount}</div></div>
            <div className="stat-card"><div className="stat-lbl">Total Sessions</div><div className="stat-num">{history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).length}</div></div>
          </div>
        )}

        {dayDetail&&mode==="tracker"&&(
          <div className="card" style={{marginTop:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div className="ctitle" style={{marginBottom:0}}>
                {new Date(dayDetail.dateStr+"T12:00:00").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"short"})}
              </div>
              <button onClick={()=>setDayDetail(null)} style={{background:"none",border:"none",color:"var(--muted2)",fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
            </div>
            {filteredGoals.map(g=>{
              const v=dayDetail.log?.entries[g.id];
              if(v===null||v===undefined) return null;
              return(
                <div key={g.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:g.color}}/>
                    <span style={{fontSize:13,color:"var(--text)"}}>{g.name}</span>
                  </div>
                  <span style={{fontSize:14,fontWeight:700,letterSpacing:0}}>{v} <span style={{fontSize:10,color:"var(--muted2)",fontWeight:400}}>{g.unit}</span></span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MacroIcon({letter,color,size=16}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:color+"22",border:`1.5px solid ${color}66`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:Math.round(size*0.55),fontWeight:800,color,flexShrink:0,lineHeight:1,letterSpacing:0}}>{letter}</div>;
}

function TrackerTab({ goals, setGoals, logs, setLogs, meals, setMeals, onOpenCalendar }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = logs.find(l => l.date === today) || { date: today, entries: {} };
  const entries = todayLog.entries || {};
  const loggedMealIds = Array.isArray(entries.logged_meals) ? entries.logged_meals : [];

  const [showAddMeal,   setShowAddMeal]   = useState(false);
  const [showAddSup,    setShowAddSup]    = useState(false);
  const [showAddMetric, setShowAddMetric] = useState(false);
  const [editingGoal,   setEditingGoal]   = useState(null);
  const [newMeal,   setNewMeal]   = useState({name:"",calories:"",protein:"",carbs:"",fat:""});
  const [newSup,    setNewSup]    = useState({name:"",unit:"",category:"Supplements",customCat:""});
  const [newMetric, setNewMetric] = useState({name:"",unit:"",target:""});

  const mealMacro = key => loggedMealIds.reduce((s,mid)=>s+((meals.find(m=>m.id===mid))?.[key]||0),0);
  const getNum  = id => { const v=entries[id]; return (v!=null&&v!==false) ? parseFloat(v)||0 : 0; };
  const getBool = id => entries[id]===true;

  const calTotal  = getNum("calories") + mealMacro("calories");
  const protTotal = getNum("protein")  + mealMacro("protein");
  const carbTotal = getNum("carbs")    + mealMacro("carbs");
  const fatTotal  = getNum("fat")      + mealMacro("fat");
  const calGoal   = goals.find(g=>g.id==="calories")?.target??2500;
  const protGoal  = goals.find(g=>g.id==="protein")?.target??150;
  const carbGoal  = goals.find(g=>g.id==="carbs")?.target??250;
  const fatGoal   = goals.find(g=>g.id==="fat")?.target??70;

  const setEntry = (id, val) => {
    setLogs(prev=>{
      const i=prev.findIndex(l=>l.date===today);
      if(i>=0){const u=[...prev];u[i]={...u[i],entries:{...u[i].entries,[id]:val}};return u;}
      return [...prev,{date:today,entries:{[id]:val}}];
    });
  };

  const step = (id,dir) => {
    const g=goals.find(g=>g.id===id);
    const inc=g?.unit==="kcal"?50:g?.unit==="kg"?0.5:g?.unit==="glasses"?1:1;
    setEntry(id, Math.max(0, parseFloat((getNum(id)+dir*inc).toFixed(2))));
  };

  const toggleMeal = mealId => {
    const cur=[...loggedMealIds];
    const idx=cur.indexOf(mealId);
    if(idx>=0) cur.splice(idx,1); else cur.push(mealId);
    setEntry("logged_meals",cur);
  };

  const toggleBool = id => setEntry(id, !getBool(id) ? true : null);

  const addMeal = () => {
    if(!newMeal.name.trim()) return;
    setMeals(ms=>[...ms,{id:`m_${uid()}`,name:newMeal.name.trim(),calories:parseFloat(newMeal.calories)||0,protein:parseFloat(newMeal.protein)||0,carbs:parseFloat(newMeal.carbs)||0,fat:parseFloat(newMeal.fat)||0}]);
    setNewMeal({name:"",calories:"",protein:"",carbs:"",fat:""});
    setShowAddMeal(false);
  };

  const addSup = () => {
    if(!newSup.name.trim()) return;
    const cat=newSup.category==="Custom"?(newSup.customCat.trim()||"Supplements"):newSup.category;
    setGoals(gs=>[...gs,{id:uid(),name:newSup.name.trim(),unit:newSup.unit.trim(),target:null,color:TRACKER_PALETTE[gs.length%TRACKER_PALETTE.length],category:cat,type:"boolean",builtIn:false}]);
    setNewSup({name:"",unit:"",category:"Supplements",customCat:""});
    setShowAddSup(false);
  };

  const addMetric = () => {
    if(!newMetric.name.trim()) return;
    setGoals(gs=>[...gs,{id:uid(),name:newMetric.name.trim(),unit:newMetric.unit.trim(),target:newMetric.target?parseFloat(newMetric.target):null,color:TRACKER_PALETTE[gs.length%TRACKER_PALETTE.length],category:"Body",type:"number",builtIn:false}]);
    setNewMetric({name:"",unit:"",target:""});
    setShowAddMetric(false);
  };

  const getHabitStreak = goalId => {
    let s=0;
    for(let i=0;i<60;i++){const d=new Date();d.setDate(d.getDate()-i);const date=d.toISOString().slice(0,10);const log=logs.find(l=>l.date===date);if(log?.entries?.[goalId]===true)s++;else break;}
    return s;
  };

  const supGoals  = goals.filter(g=>g.type==="boolean");
  const bodyGoals = goals.filter(g=>g.type!=="boolean"&&g.type!=="macro"&&g.category!=="Food");
  const supCats   = [...new Set(supGoals.map(g=>g.category||"Supplements"))];
  const last7     = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10);});
  const dateStr   = new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  const CalSvg    = ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>;

  return(<>
    <div className="phdr">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><h1>TRACK</h1><p>{dateStr}</p></div>
        <button className="trk-cal-btn" onClick={onOpenCalendar} style={{marginTop:10}}><CalSvg/> Calendar</button>
      </div>
    </div>

    <div className="scroll">

      {/* ── DAY SCORE ── */}
      {(()=>{
        const macrosDone=[calTotal>=calGoal*0.8,protTotal>=(goals.find(g=>g.id==="protein")?.target??150)*0.8].filter(Boolean).length;
        const supDoneCount=supGoals.filter(g=>getBool(g.id)).length;
        const bodyDoneCount=bodyGoals.filter(g=>g.target&&(parseFloat(entries[g.id])||0)>=g.target).length;
        const total=2+supGoals.length+bodyGoals.filter(g=>g.target).length;
        const done=macrosDone+supDoneCount+bodyDoneCount;
        if(total===0) return null;
        const pct=Math.round((done/total)*100);
        return(
          <div style={{display:"flex",alignItems:"center",gap:12,background:"var(--s2)",borderRadius:14,padding:"10px 14px",marginBottom:10,border:"1px solid var(--border)"}}>
            <div style={{position:"relative",width:42,height:42,flexShrink:0}}>
              <svg viewBox="0 0 42 42" style={{transform:"rotate(-90deg)",width:42,height:42}}>
                <circle cx="21" cy="21" r="17" fill="none" stroke="var(--s3)" strokeWidth="4"/>
                <circle cx="21" cy="21" r="17" fill="none" stroke={pct>=80?"var(--green)":"var(--accent)"} strokeWidth="4"
                  strokeDasharray={`${2*Math.PI*17}`} strokeDashoffset={`${2*Math.PI*17*(1-pct/100)}`} strokeLinecap="round" style={{transition:"stroke-dashoffset .5s"}}/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:pct>=80?"var(--green)":"var(--accent2)"}}>{pct}%</div>
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{done} of {total} goals met today</div>
              <div style={{fontSize:11,color:"var(--muted2)",marginTop:2}}>{pct>=100?"Perfect day! All goals complete":pct>=80?"Almost there — keep going!":"Keep tracking to hit your goals"}</div>
            </div>
          </div>
        );
      })()}

      {/* ── NUTRITION + MEALS (merged card) ── */}
      <div className="card" style={{marginBottom:12}}>
        <div className="ctitle">TODAY'S NUTRITION</div>

        {/* Big calorie + bar */}
        <div style={{display:"flex",alignItems:"flex-end",gap:6,marginBottom:8}}>
          <span className="macro-big" style={{color:calTotal>0?"var(--text)":"var(--muted)"}}>{Math.round(calTotal)}</span>
          <span style={{color:"var(--muted2)",fontSize:13,paddingBottom:7}}>/ {calGoal} kcal</span>
          {calTotal>0&&<span style={{marginLeft:"auto",fontSize:11,paddingBottom:9,fontWeight:600,color:calTotal>calGoal?"#f59e0b":calTotal>=calGoal*0.95?"var(--green)":"var(--accent2)"}}>{calTotal>calGoal?`+${Math.round(calTotal-calGoal)} surplus`:Math.round(calGoal-calTotal)+" kcal left"}</span>}
        </div>
        <div style={{height:6,borderRadius:3,background:"var(--s3)",overflow:"hidden",marginBottom:14}}>
          <div style={{height:"100%",width:`${Math.min(100,(calTotal/calGoal)*100)}%`,background:"linear-gradient(90deg,var(--accent),var(--accent2))",borderRadius:3,transition:"width .5s ease"}}/>
        </div>

        {/* Macro mini cards with icons */}
        <div className="macro-sub" style={{marginBottom:14}}>
          {[{label:"Protein",letter:"P",total:protTotal,goal:protGoal,color:"#4ECDC4",id:"protein"},
            {label:"Carbs",  letter:"C",total:carbTotal,goal:carbGoal,color:"#FFD166",id:"carbs"},
            {label:"Fat",    letter:"F",total:fatTotal, goal:fatGoal, color:"#f59e0b",id:"fat"}
          ].map(m=>(
            <div key={m.id} className="macro-mini" onClick={()=>setEditingGoal({id:m.id,val:String(goals.find(g=>g.id===m.id)?.target??"")})} style={{borderColor:m.color+"30"}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                <MacroIcon letter={m.letter} color={m.color} size={14}/>
                <span style={{fontSize:10,fontWeight:700,color:m.color,letterSpacing:1,textTransform:"uppercase"}}>{m.label}</span>
              </div>
              <div style={{fontWeight:800,fontSize:18,letterSpacing:-.5,color:m.total>0?"var(--text)":"var(--muted2)"}}>{Math.round(m.total)}<span style={{fontSize:10,color:"var(--muted2)",fontWeight:400}}>/{m.goal}g</span></div>
              <div style={{height:2,borderRadius:1,background:"var(--s3)",marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(100,(m.total/m.goal)*100)}%`,background:m.color,borderRadius:1,transition:"width .4s"}}/></div>
            </div>
          ))}
        </div>

        {/* ── MEALS (inside nutrition card) ── */}
        <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,color:"var(--muted2)",textTransform:"uppercase"}}>MEALS</div>
            <button className="add-mini-btn" onClick={()=>setShowAddMeal(v=>!v)}>+ Add</button>
          </div>

          {showAddMeal&&(
            <div style={{background:"var(--s3)",borderRadius:12,padding:12,marginBottom:10,border:"1px solid var(--border2)"}}>
              <div className="form-lbl">Meal Name</div>
              <input className="form-input" placeholder="e.g. Chicken & Rice" value={newMeal.name} onChange={e=>setNewMeal(m=>({...m,name:e.target.value}))}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                <div><div className="form-lbl">Calories</div><input className="form-input" type="number" placeholder="kcal" value={newMeal.calories} onChange={e=>setNewMeal(m=>({...m,calories:e.target.value}))}/></div>
                <div><div className="form-lbl">Protein (g)</div><input className="form-input" type="number" placeholder="g" value={newMeal.protein} onChange={e=>setNewMeal(m=>({...m,protein:e.target.value}))}/></div>
                <div><div className="form-lbl">Carbs (g)</div><input className="form-input" type="number" placeholder="g" value={newMeal.carbs} onChange={e=>setNewMeal(m=>({...m,carbs:e.target.value}))}/></div>
                <div><div className="form-lbl">Fat (g)</div><input className="form-input" type="number" placeholder="g" value={newMeal.fat} onChange={e=>setNewMeal(m=>({...m,fat:e.target.value}))}/></div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button className="btn-ghost" style={{flex:1,padding:"9px 0"}} onClick={()=>{setShowAddMeal(false);setNewMeal({name:"",calories:"",protein:"",carbs:"",fat:""});}}>Cancel</button>
                <button className="btn-accent" style={{flex:2,fontSize:15,padding:10}} onClick={addMeal}>Save Meal</button>
              </div>
            </div>
          )}

          {meals.length===0&&!showAddMeal&&<p style={{color:"var(--muted)",fontSize:12,padding:"4px 0 8px"}}>Add regular meals to quick-log them here</p>}

          {meals.map((m,mi)=>{
            const isLogged=loggedMealIds.includes(m.id);
            return(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:mi<meals.length-1?"1px solid var(--border)":"none"}}>
                <div onClick={()=>toggleMeal(m.id)} style={{width:22,height:22,borderRadius:7,border:isLogged?"1px solid rgba(76,175,80,.5)":"1px solid var(--border2)",background:isLogged?"rgba(76,175,80,.15)":"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:isLogged?"var(--green)":"transparent",cursor:"pointer",flexShrink:0,transition:"all .15s"}}>✓</div>
                <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>toggleMeal(m.id)}>
                  <div style={{fontWeight:600,fontSize:13,color:isLogged?"var(--text)":"var(--muted2)",transition:"color .15s"}}>{m.name}</div>
                  <div style={{fontSize:10,color:"var(--muted2)",marginTop:1,display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{color:"var(--accent2)",fontWeight:600}}>{m.calories} kcal</span>
                    <span style={{display:"flex",alignItems:"center",gap:2}}><MacroIcon letter="P" color="#4ECDC4" size={9}/>{m.protein}g</span>
                    <span style={{display:"flex",alignItems:"center",gap:2}}><MacroIcon letter="C" color="#FFD166" size={9}/>{m.carbs}g</span>
                    <span style={{display:"flex",alignItems:"center",gap:2}}><MacroIcon letter="F" color="#f59e0b" size={9}/>{m.fat}g</span>
                  </div>
                </div>
                <button onClick={()=>setMeals(ms=>ms.filter(x=>x.id!==m.id))} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:16,lineHeight:1,padding:"2px 4px",flexShrink:0}}>×</button>
              </div>
            );
          })}
        </div>

        {/* Goal hint + inline editor */}
        <div style={{borderTop:"1px solid var(--border)",paddingTop:10,marginTop:10}}>
          <div style={{fontSize:11,color:"var(--muted2)",textAlign:"center",cursor:"pointer"}} onClick={()=>setEditingGoal({id:"calories",val:String(calGoal)})}>
            Goal: {calGoal} kcal · tap a macro card to edit
          </div>
          {editingGoal&&(
            <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"var(--muted2)",flex:1}}>{goals.find(g=>g.id===editingGoal.id)?.name} goal:</span>
              <input autoFocus type="number" value={editingGoal.val} onChange={e=>setEditingGoal(eg=>({...eg,val:e.target.value}))}
                style={{width:80,background:"var(--s2)",border:"1.5px solid var(--accent)",borderRadius:8,color:"var(--text)",fontSize:15,padding:"5px 8px",outline:"none",textAlign:"center"}}/>
              <span style={{fontSize:11,color:"var(--muted2)"}}>{goals.find(g=>g.id===editingGoal.id)?.unit}</span>
              <button onClick={()=>{setGoals(gs=>gs.map(g=>g.id===editingGoal.id?{...g,target:parseFloat(editingGoal.val)||g.target}:g));setEditingGoal(null);}} style={{background:"var(--accent)",border:"none",borderRadius:8,color:"#fff",fontSize:12,fontWeight:700,padding:"5px 12px",cursor:"pointer"}}>Save</button>
              <button onClick={()=>setEditingGoal(null)} style={{background:"none",border:"none",color:"var(--muted2)",fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* ── SUPPLEMENTS & HABITS ── */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-header">
          <div className="ctitle" style={{marginBottom:0}}>SUPPLEMENTS & HABITS</div>
          <button className="add-mini-btn" onClick={()=>setShowAddSup(v=>!v)}>+ Add</button>
        </div>
        {showAddSup&&(
          <div style={{background:"var(--s2)",borderRadius:12,padding:12,marginBottom:12,border:"1px solid var(--border2)"}}>
            <div className="form-lbl">Name</div>
            <input className="form-input" placeholder="e.g. Vitamin D, Omega-3, Morning Walk..." value={newSup.name} onChange={e=>setNewSup(s=>({...s,name:e.target.value}))}/>
            <div style={{marginTop:8}}><div className="form-lbl">Note (optional)</div><input className="form-input" placeholder="e.g. 5000 IU, before bed" value={newSup.unit} onChange={e=>setNewSup(s=>({...s,unit:e.target.value}))}/></div>
            <div style={{marginTop:10}}>
              <div className="form-lbl">Category</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                {["Supplements","Vitamins","Habits","Custom"].map(c=>(
                  <button key={c} onClick={()=>setNewSup(s=>({...s,category:c}))}
                    style={{padding:"5px 13px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:"1px solid",transition:"all .15s",
                      borderColor:newSup.category===c?"var(--accent)":"var(--border2)",
                      background:newSup.category===c?"rgba(var(--accent-rgb),.12)":"var(--s3)",
                      color:newSup.category===c?"var(--accent2)":"var(--muted2)"}}>{c}</button>
                ))}
              </div>
              {newSup.category==="Custom"&&(
                <input className="form-input" style={{marginTop:8}} placeholder="Your category name..." value={newSup.customCat} onChange={e=>setNewSup(s=>({...s,customCat:e.target.value}))}/>
              )}
            </div>
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button className="btn-ghost" style={{flex:1,padding:"9px 0"}} onClick={()=>{setShowAddSup(false);setNewSup({name:"",unit:"",category:"Supplements",customCat:""});}}>Cancel</button>
              <button className="btn-accent" style={{flex:2,fontSize:15,padding:10}} onClick={addSup}>Add</button>
            </div>
          </div>
        )}
        {supGoals.length===0&&!showAddSup&&<p style={{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"12px 0"}}>Track your supplements and daily habits</p>}
        {supCats.map((cat,ci)=>(
          <div key={cat}>
            {supCats.length>1&&<div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,color:"var(--muted)",textTransform:"uppercase",padding:"8px 0 4px",borderTop:ci>0?"1px solid var(--border)":"none"}}>{cat}</div>}
            {supGoals.filter(g=>(g.category||"Supplements")===cat).map((g,gi,arr)=>{
              const done=getBool(g.id);
              const streak=getHabitStreak(g.id);
              return(
                <div key={g.id} className="habit-row" style={{borderBottom:gi<arr.length-1?"1px solid var(--border)":"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:g.color,flexShrink:0,boxShadow:`0 0 8px ${g.color}88`}}/>
                    <div>
                      <div style={{fontWeight:500,fontSize:14,display:"flex",alignItems:"center",gap:7}}>
                        {g.name}
                        {streak>=2&&<span style={{fontSize:10,fontWeight:700,background:g.color+"22",color:g.color,padding:"1px 6px",borderRadius:10}}>🔥{streak}d</span>}
                      </div>
                      {g.unit&&<div style={{fontSize:11,color:"var(--muted2)",marginTop:1}}>{g.unit}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <button className={`done-btn ${done?"done":"notdone"}`} onClick={()=>toggleBool(g.id)}>{done?"✓ Done":"Mark Done"}</button>
                    {!g.builtIn&&<button onClick={()=>setGoals(gs=>gs.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:18,lineHeight:1,padding:2}}>×</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── BODY METRICS ── */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-header">
          <div className="ctitle" style={{marginBottom:0}}>BODY METRICS</div>
          <button className="add-mini-btn" onClick={()=>setShowAddMetric(v=>!v)}>+ Add</button>
        </div>
        {showAddMetric&&(
          <div style={{background:"var(--s2)",borderRadius:12,padding:12,marginBottom:12,border:"1px solid var(--border2)"}}>
            <div className="form-lbl">Name</div>
            <input className="form-input" placeholder="e.g. Steps, Sleep hours, HRV..." value={newMetric.name} onChange={e=>setNewMetric(m=>({...m,name:e.target.value}))}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
              <div><div className="form-lbl">Unit</div><input className="form-input" placeholder="kg, hrs, steps..." value={newMetric.unit} onChange={e=>setNewMetric(m=>({...m,unit:e.target.value}))}/></div>
              <div><div className="form-lbl">Daily Goal</div><input className="form-input" type="number" placeholder="optional" value={newMetric.target} onChange={e=>setNewMetric(m=>({...m,target:e.target.value}))}/></div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button className="btn-ghost" style={{flex:1,padding:"9px 0"}} onClick={()=>{setShowAddMetric(false);setNewMetric({name:"",unit:"",target:""});}}>Cancel</button>
              <button className="btn-accent" style={{flex:2,fontSize:15,padding:10}} onClick={addMetric}>Add Metric</button>
            </div>
          </div>
        )}
        {bodyGoals.map((g,gi)=>{
          const val=entries[g.id]??""
          const numVal=parseFloat(val)||0;
          const pct=g.target?Math.min(100,(numVal/g.target)*100):null;
          return(
            <div key={g.id} className="metric-row" style={{borderBottom:gi<bodyGoals.length-1?"1px solid var(--border)":"none"}}>
              <div>
                <div style={{fontWeight:500,fontSize:14}}>{g.name}</div>
                {pct!==null?<div style={{fontSize:11,color:pct>=100?"var(--green)":"var(--muted2)",marginTop:2}}>{numVal}/{g.target} {g.unit}</div>
                  :<div style={{fontSize:11,color:"var(--muted2)",marginTop:2}}>{val||"—"} {g.unit}</div>}
              </div>
              <div className="metric-ctrl">
                <button className="step-btn" onClick={()=>step(g.id,-1)}>−</button>
                <input className="metric-field" type="number" value={val} placeholder="0" onChange={e=>setEntry(g.id,e.target.value===""?null:parseFloat(e.target.value))}/>
                <button className="step-btn" onClick={()=>step(g.id,1)}>+</button>
                <span style={{fontSize:10,color:"var(--muted2)",width:36,flexShrink:0}}>{g.unit}</span>
                {!g.builtIn&&<button onClick={()=>setGoals(gs=>gs.filter(x=>x.id!==g.id))} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:16,padding:2}}>×</button>}
              </div>
            </div>
          );
        })}
        {bodyGoals.length===0&&!showAddMetric&&<p style={{color:"var(--muted)",fontSize:13,textAlign:"center",padding:"12px 0"}}>Track weight, water, steps, and more</p>}
      </div>

      {/* ── 7-DAY STRIP ── */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-header">
          <div className="ctitle" style={{marginBottom:0}}>THIS WEEK</div>
          <button className="add-mini-btn" onClick={onOpenCalendar}>Full Calendar ›</button>
        </div>
        {(()=>{
          const dayData=last7.map(date=>{
            const log=logs.find(l=>l.date===date)||{entries:{}};
            const lm=Array.isArray(log.entries?.logged_meals)?log.entries.logged_meals:[];
            const dayCal=(parseFloat(log.entries?.calories)||0)+lm.reduce((s,mid)=>s+(meals.find(m=>m.id===mid)?.calories||0),0);
            const supDone=supGoals.filter(g=>log.entries?.[g.id]===true).length;
            return{date,dayCal,supDone};
          });
          const loggedDays=dayData.filter(d=>d.dayCal>0);
          const avgCal=loggedDays.length?Math.round(loggedDays.reduce((s,d)=>s+d.dayCal,0)/loggedDays.length):0;
          const totalSupChecks=dayData.reduce((s,d)=>s+d.supDone,0);
          return(<>
            <div style={{display:"flex",gap:3,justifyContent:"space-between"}}>
              {dayData.map(({date,dayCal,supDone})=>{
                const pct=calGoal?Math.min(1,dayCal/calGoal):0;
                const isToday=date===today;
                const dayLabel=new Date(date+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short"}).slice(0,2).toUpperCase();
                return(
                  <div key={date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <div style={{fontSize:9,fontWeight:700,color:isToday?"var(--accent2)":"var(--muted)",textTransform:"uppercase",letterSpacing:.5}}>{dayLabel}</div>
                    <div style={{width:34,height:34,borderRadius:10,background:pct>0?`rgba(var(--accent-rgb),${(0.1+pct*0.55).toFixed(2)})`:"var(--s2)",border:isToday?"1.5px solid var(--accent)":"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:pct>=0.9?"var(--green)":pct>0?"var(--accent2)":"var(--muted)"}}>
                      {isToday?"●":pct>=0.9?"✓":pct>0?`${Math.round(pct*100)}%`:""}
                    </div>
                    {dayCal>0&&<div style={{fontSize:8,color:"var(--muted)",textAlign:"center",lineHeight:1.2}}>{Math.round(dayCal)}<br/>{supDone>0&&<span style={{color:"var(--accent2)"}}>{supDone}✓</span>}</div>}
                  </div>
                );
              })}
            </div>
            {(avgCal>0||totalSupChecks>0)&&(
              <div style={{display:"flex",gap:12,justifyContent:"center",marginTop:10,borderTop:"1px solid var(--border)",paddingTop:8}}>
                {avgCal>0&&<span style={{fontSize:11,color:"var(--muted2)"}}>Avg: <span style={{color:"var(--text)",fontWeight:700}}>{avgCal} kcal/day</span></span>}
                {totalSupChecks>0&&<span style={{fontSize:11,color:"var(--muted2)"}}>Habits: <span style={{color:"var(--accent2)",fontWeight:700}}>{totalSupChecks} checks</span></span>}
              </div>
            )}
          </>);
        })()}
      </div>

      {/* ── NUTRITION GOALS ── */}
      <div className="card" style={{marginBottom:12}}>
        <div className="section-header"><div className="ctitle" style={{marginBottom:0}}>NUTRITION GOALS</div></div>
        {[{id:"calories",label:"Calories",unit:"kcal",color:"#7c3aed"},{id:"protein",label:"Protein",unit:"g",color:"#4ECDC4"},{id:"carbs",label:"Carbs",unit:"g",color:"#FFD166"},{id:"fat",label:"Fat",unit:"g",color:"#f59e0b"}].map(({id,label,unit,color})=>{
          const g=goals.find(x=>x.id===id);
          const val=g?.target??"";
          return(<div key={id} className="nutri-goal-row">
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
              <div style={{fontWeight:500,fontSize:14}}>{label}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="number" value={val} onChange={e=>{const v=parseFloat(e.target.value);if(!isNaN(v))setGoals(gs=>gs.map(x=>x.id===id?{...x,target:v}:x));}}
                style={{width:72,background:"var(--s2)",border:"1px solid var(--border2)",borderRadius:8,color:"var(--text)",fontSize:14,padding:"5px 8px",textAlign:"right",outline:"none",fontFamily:"var(--db)"}}/>
              <span style={{fontSize:12,color:"var(--muted2)",width:30}}>{unit}</span>
            </div>
          </div>);
        })}
      </div>
    </div>
  </>);
}

export default function App() {
  const [user,          setUser]         = useState(()=>ls.get("gr_user",null));
  const [tab,           setTab]          = useState("home");
  const [history,       setHistory]      = useState([]);
  const [program,       setProgram]      = useState(DEFAULT_PROGRAM);
  const [sheetId,       setSheetId]      = useState(null);
  const [restEnabled,   setRestEnabled]  = useState(true);
  const [chatSessions,  setChatSessions] = useState([]);
  const [trackerGoals,  setTrackerGoals] = useState(DEFAULT_TRACKER_GOALS);
  const [trackerLogs,   setTrackerLogs]  = useState([]);
  const [meals,         setMeals]        = useState(DEFAULT_MEALS);
  const [dataLoaded,    setDataLoaded]   = useState(false);
  const [calMode,       setCalMode]      = useState(null);
  const swipeRef = useRef({x:null,y:null});
  const TABS = ["home","workout","tracker","chat","settings"];
  const [tabAnim,setTabAnim]=useState(null);
  const tabAnimTimer=useRef(null);
  const switchTab=(newTab)=>{
    const cur=TABS.indexOf(tab),next=TABS.indexOf(newTab);
    if(cur===next) return;
    const dir=next>cur?"left":"right";
    setTab(newTab);
    setTabAnim(dir);
    clearTimeout(tabAnimTimer.current);
    tabAnimTimer.current=setTimeout(()=>setTabAnim(null),250);
  };
  const onSwipeStart = e => { swipeRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
  const onSwipeEnd = e => {
    const {x,y}=swipeRef.current; if(x===null) return;
    swipeRef.current={x:null,y:null};
    const dx=e.changedTouches[0].clientX-x, dy=e.changedTouches[0].clientY-y;
    if(Math.abs(dx)<55||Math.abs(dy)>Math.abs(dx)*0.7) return;
    const idx=TABS.indexOf(tab);
    if(dx<0&&idx<TABS.length-1) switchTab(TABS[idx+1]);
    else if(dx>0&&idx>0) switchTab(TABS[idx-1]);
  };
  const [activeWorkout, setActiveWorkout]= useState(null);
  const [restTimer,     setRestTimer]    = useState(null);
  const [restMinimized, setRestMinimized]= useState(false);
  const [editingDay,    setEditingDay]   = useState(null);
  const [histDetail,    setHistDetail]   = useState(null);
  const restRef        = useRef(null);
  const saveTimer      = useRef(null);
  const tokenExpired   = useRef(false);
  const todayCardRef   = useRef(null);

  useEffect(()=>{if(user)ls.set("gr_user",user);},[user]);

  useEffect(()=>{
    if(tab==="workout"&&todayCardRef.current){
      setTimeout(()=>todayCardRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),80);
    }
  },[tab]);

  // Load all data from Supabase on login
  useEffect(()=>{
    if(!user?.accessToken||user.demo){setDataLoaded(true);return;}
    const apiBase=import.meta.env.VITE_API_URL??"";
    fetch(`${apiBase}/api/db`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load",accessToken:user.accessToken})})
      .then(r=>{if(r.status===401){tokenExpired.current=true;console.warn("[db] session expired");return null;}return r.json();})
      .then(d=>{
        if(!d){setDataLoaded(true);return;}
        if(d.program?.length) setProgram(d.program);
        if(d.history)         setHistory(d.history);
        if(d.chat_sessions)   setChatSessions(d.chat_sessions);
        if(d.sheet_id)        setSheetId(d.sheet_id);
        if(typeof d.rest_enabled==="boolean") setRestEnabled(d.rest_enabled);
        if(d.tracker_goals?.length){
          const saved=d.tracker_goals;
          const missing=DEFAULT_TRACKER_GOALS.filter(dg=>dg.builtIn&&!saved.find(sg=>sg.id===dg.id));
          setTrackerGoals([...missing,...saved]);
        }
        if(d.tracker_logs)    setTrackerLogs(d.tracker_logs);
        if(d.meals?.length)   setMeals(d.meals);
        setDataLoaded(true);
      })
      .catch(()=>setDataLoaded(true));
  },[user?.accessToken]);

  // Debounced save to Supabase whenever data changes
  useEffect(()=>{
    if(!user?.accessToken||user.demo||!dataLoaded||tokenExpired.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      if(tokenExpired.current) return;
      const apiBase=import.meta.env.VITE_API_URL??"";
      fetch(`${apiBase}/api/db`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",accessToken:user.accessToken,program,history,chat_sessions:chatSessions,sheet_id:sheetId,rest_enabled:restEnabled,tracker_goals:trackerGoals,tracker_logs:trackerLogs,meals})})
        .then(r=>{if(r.status===401){tokenExpired.current=true;console.warn("[db] save: session expired");}})
        .catch(console.error);
    },1500);
    return()=>clearTimeout(saveTimer.current);
  },[program,history,chatSessions,sheetId,restEnabled,trackerGoals,trackerLogs,meals,dataLoaded]);

  useEffect(()=>{
    const hash=window.location.hash;
    if(!hash) return;
    const params=new URLSearchParams(hash.slice(1));
    const token=params.get("access_token");
    if(!token) return;
    window.history.replaceState(null,"",window.location.pathname);
    fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json()).then(info=>{
        if(!ls.get("gr_start",null)) ls.set("gr_start",new Date().toISOString());
        setUser({name:info.name,email:info.email,picture:info.picture,accessToken:token});
      }).catch(()=>{});
  },[]);

  const startDate=ls.get("gr_start",null);
  const todayIdx=startDate?(()=>{
    const start=new Date(startDate);
    const now=new Date();
    const startMidnight=new Date(start.getFullYear(),start.getMonth(),start.getDate());
    const nowMidnight=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const days=Math.floor((nowMidnight-startMidnight)/(1000*60*60*24));
    return((days%program.length)+program.length)%program.length;
  })():0;
  const todayDay=program[todayIdx];

  const startRest=useCallback((secs)=>{
    if(!restEnabled||!secs) return;
    requestNotificationPermission();
    setRestTimer(secs);
    setRestMinimized(false);
    clearInterval(restRef.current);
    restRef.current=setInterval(()=>{
      setRestTimer(t=>{
        if(t<=1){
          clearInterval(restRef.current);
          playRestEndSound();
          sendRestNotification();
          return null;
        }
        return t-1;
      });
    },1000);
  },[restEnabled]);

  const handleFinish=useCallback(async(session)=>{
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

  const updateDay=(id,ch)=>setProgram(p=>p.map(d=>d.id===id?{...d,...ch}:d));
  const updateEx=(did,eid,ch)=>setProgram(p=>p.map(d=>d.id!==did?d:{...d,exercises:d.exercises.map(e=>e.id===eid?{...e,...ch}:e)}));
  const addEx=(did)=>setProgram(p=>p.map(d=>d.id!==did?d:{...d,exercises:[...d.exercises,{id:uid(),name:"New Exercise",sets:3,reps:10,rest:120,weight:20}]}));
  const removeEx=(did,eid)=>setProgram(p=>p.map(d=>d.id!==did?d:{...d,exercises:d.exercises.filter(e=>e.id!==eid)}));
  const addDay=()=>setProgram(p=>[...p,{id:uid(),label:"New Day",color:"#888",isRest:true,exercises:[]}]);
  const moveDay=(arr)=>setProgram(arr);

  const handleDemo=()=>{ if(!ls.get("gr_start",null))ls.set("gr_start",new Date().toISOString()); setUser({name:"Demo User",email:"demo@example.com",demo:true}); };
  const handleLogin=()=>{
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if(!clientId){ handleDemo(); return; }
    const redirect = window.location.origin;
    const scope = encodeURIComponent("openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/calendar");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token&scope=${scope}&prompt=select_account`;
    window.location.href = url;
  };
  const handleConnectSheets=async()=>{ if(!user?.accessToken)return alert("Sign in with Google first."); try{ const r=await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",accessToken:user.accessToken})}); const d=await r.json(); if(d.spreadsheetId){setSheetId(d.spreadsheetId);alert("Google Sheet created!");} }catch{alert("Error.");} };
  const handleCalendar=async()=>{ if(!user?.accessToken)return alert("Sign in with Google first."); const r=await fetch("/api/calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:user.accessToken,startDate:ls.get("gr_start",new Date().toISOString())})}); const d=await r.json(); if(d.ok)alert(`${d.eventsCreated} calendar reminders added!`); };

  const [theme, setTheme] = useState(()=>ls.get("gr_theme","orange"));
  const themeObj = THEMES.find(t=>t.id===theme)||THEMES[0];
  const themeCSS = theme==="orange" ? "" : `:root{--accent:${themeObj.accent};--accent2:${themeObj.accent2};--accent-rgb:${themeObj.rgb};}`;

  const totalSessions=history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-todayIdx); weekStart.setHours(0,0,0,0);
  const thisWeek=history.filter(h=>new Date(h.date)>=weekStart&&!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const streak=calcStreak(history,program);
  const bestStreak=calcBestStreak(history,program);
  const {onDragStart,onDragEnter,onDragOver,onDrop,onDragEnd}=useDragList(program,moveDay);

  if(!user) return(<><style>{CSS}</style><div className="login">
    <div className="login-logo">GRIND</div>
    <p className="login-tagline">Your free AI personal trainer.<br/>Track. Progress. Never skip leg day.</p>
    <button className="google-btn" onClick={handleLogin}><Ic.Google/> Continue with Google</button>
  </div></>);

  if(!dataLoaded) return(<><style>{CSS}</style><div className="login"><div className="login-logo">GRIND</div><p style={{color:"var(--muted)"}}>Loading your data...</p></div></>);

  const RestTimerUI=()=>(<>
    {restTimer!==null&&!restMinimized&&(
      <div className="rest-overlay">
        <button className="rest-close" onClick={()=>setRestMinimized(true)}>×</button>
        <div className="rest-lbl">REST</div>
        <div className="rest-num" style={{color:restTimer<=10?"var(--accent)":"var(--text)"}}>{restTimer}</div>
        <button className="rest-skip" onClick={()=>{clearInterval(restRef.current);setRestTimer(null);}}>Skip rest</button>
      </div>
    )}
    {restTimer!==null&&restMinimized&&(
      <div className="rest-pill" onClick={()=>setRestMinimized(false)}>
        <Ic.Clock/>
        <span className="rest-pill-num">{restTimer}s</span>
        <button onClick={e=>{e.stopPropagation();clearInterval(restRef.current);setRestTimer(null);}} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:18,lineHeight:1,padding:"0 2px"}}>×</button>
      </div>
    )}
  </>);

  if(activeWorkout) return(<><style>{CSS}</style><div className="app">
    <WorkoutSession workout={activeWorkout} history={history} onFinish={handleFinish} onBack={()=>setActiveWorkout(null)} startRest={startRest} restEnabled={restEnabled}/>
    <RestTimerUI/>
  </div></>);

  if(histDetail) return(<><style>{CSS}</style><div className="app">
    <HistoryDetail session={histDetail} program={program} onBack={()=>setHistDetail(null)} onDelete={()=>{setHistory(h=>h.filter(s=>!(s.date===histDetail.date&&s.dayKey===histDetail.dayKey)));setHistDetail(null);}}/>
  </div></>);

  return(<><style>{CSS}</style>{themeCSS&&<style>{themeCSS}</style>}<div className="app" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>

    <RestTimerUI/>
    {calMode&&<BigCalendar mode={calMode} program={program} history={history} startDate={ls.get("gr_start",null)} trackerGoals={trackerGoals} trackerLogs={trackerLogs} onClose={()=>setCalMode(null)} onSessionClick={s=>{setCalMode(null);setHistDetail(s);}}/>}
    <div key={tab} className={tabAnim?`tab-slide-${tabAnim}`:""} style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>

    {tab==="home"&&(()=>{
      const hr=new Date().getHours();
      const grt=hr<12?"Good morning":hr<17?"Good afternoon":hr<21?"Good evening":"Good night";
      const todayStr=new Date().toISOString().slice(0,10);
      const doneToday=history.some(h=>h.date===todayStr&&h.dayKey===todayDay.id&&!todayDay.isRest);
      return(<>
      <div className="phdr"><div className="hdr-row"><div><h1>GRIND</h1><p>{grt}, {user.name?.split(" ")[0]}!</p></div><div style={{display:"flex",gap:8}}><button className="streak-chip" onClick={()=>setCalMode("streak")} style={{cursor:"pointer",background:"var(--s2)",border:"1px solid var(--border2)"}}>&#x1F525; {streak}</button></div></div></div>
      <div className="scroll">
        <div className="stats-row">
          <div className="stat-card"><div className="stat-lbl">Total sessions</div><div className="stat-num">{totalSessions}</div></div>
          <div className="stat-card"><div className="stat-lbl">This week</div><div className="stat-num">{thisWeek}</div></div>
          <div className="stat-card"><div className="stat-lbl">Best streak</div><div className="stat-num">{bestStreak}</div></div>
        </div>
        {(()=>{
          const td=new Date().toISOString().slice(0,10);
          const tLog=trackerLogs.find(l=>l.date===td)||{entries:{}};
          const tEnt=tLog.entries||{};
          const tMealIds=Array.isArray(tEnt.logged_meals)?tEnt.logged_meals:[];
          const tCal=(parseFloat(tEnt.calories)||0)+tMealIds.reduce((s,mid)=>s+(meals.find(m=>m.id===mid)?.calories||0),0);
          const tProt=(parseFloat(tEnt.protein)||0)+tMealIds.reduce((s,mid)=>s+(meals.find(m=>m.id===mid)?.protein||0),0);
          const tCarb=(parseFloat(tEnt.carbs)||0)+tMealIds.reduce((s,mid)=>s+(meals.find(m=>m.id===mid)?.carbs||0),0);
          const tFat=(parseFloat(tEnt.fat)||0)+tMealIds.reduce((s,mid)=>s+(meals.find(m=>m.id===mid)?.fat||0),0);
          const tCalGoal=trackerGoals.find(g=>g.id==="calories")?.target??2500;
          const tPct=Math.min(100,(tCal/tCalGoal)*100);
          if(tCal===0&&tProt===0&&tCarb===0&&tFat===0) return null;
          const tProtGoal=trackerGoals.find(g=>g.id==="protein")?.target??150;
          const tWater=parseFloat(tEnt.water)||0;
          const tWaterGoal=trackerGoals.find(g=>g.id==="water")?.target??8;
          const addWater=()=>setTrackerLogs(prev=>{const i=prev.findIndex(l=>l.date===td);const nv=tWater+1;if(i>=0){const u=[...prev];u[i]={...u[i],entries:{...u[i].entries,water:nv}};return u;}return [...prev,{date:td,entries:{water:nv}}];});
          return(
            <div className="card" style={{marginBottom:12,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div className="ctitle" style={{margin:0}}>TODAY'S NUTRITION</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:"#06b6d4"}}>💧</span>
                  <span style={{fontSize:12,fontWeight:700,color:tWater>=tWaterGoal?"var(--green)":"var(--text)"}}>{tWater}<span style={{color:"var(--muted2)",fontWeight:400}}>/{tWaterGoal}</span></span>
                  <button onClick={addWater} style={{background:"rgba(6,182,212,.15)",border:"1px solid rgba(6,182,212,.35)",borderRadius:8,color:"#06b6d4",fontWeight:700,fontSize:12,padding:"3px 9px",cursor:"pointer",lineHeight:1.4}}>+1</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"flex-end",gap:14,marginBottom:8}}>
                <div>
                  <div style={{fontWeight:800,fontSize:32,letterSpacing:-1,color:"var(--text)",lineHeight:1}}>{Math.round(tCal)}</div>
                  <div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>/ {tCalGoal} kcal</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{height:4,borderRadius:2,background:"var(--s3)",marginBottom:6,overflow:"hidden"}}><div style={{height:"100%",width:`${tPct}%`,background:"linear-gradient(90deg,var(--accent),var(--accent2))",borderRadius:2}}/></div>
                  <div style={{display:"flex",gap:10,fontSize:11}}>
                    <span><span style={{color:"#4ECDC4",fontWeight:700}}>P </span><span style={{color:"var(--text)"}}>{Math.round(tProt)}g</span><span style={{color:"var(--muted)",fontSize:9}}>/{tProtGoal}</span></span>
                    <span><span style={{color:"#FFD166",fontWeight:700}}>C </span><span style={{color:"var(--text)"}}>{Math.round(tCarb)}g</span></span>
                    <span><span style={{color:"#f59e0b",fontWeight:700}}>F </span><span style={{color:"var(--text)"}}>{Math.round(tFat)}g</span></span>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:700,paddingBottom:2,color:tCal>=tCalGoal?"#e24b4a":"var(--muted2)",textAlign:"right",minWidth:50}}>
                  {tCal>=tCalGoal?`+${Math.round(tCal-tCalGoal)} over`:`${Math.round(tCalGoal-tCal)} left`}
                </div>
              </div>
            </div>
          );
        })()}
        <div className="card" style={{borderColor:doneToday?"var(--green)":todayDay.color+"55"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
            <div className="day-badge" style={{background:todayDay.color+"22",color:todayDay.color,margin:0}}>TODAY</div>
            {doneToday&&<div className="day-badge" style={{background:"rgba(76,175,80,.15)",color:"var(--green)",margin:0}}>✓ DONE</div>}
          </div>
          <div className="day-label">{todayDay.label}</div>
          {!todayDay.isRest&&todayDay.exercises.length>0?<>
            <div className="ex-preview">{todayDay.exercises.map(ex=>{
              const eh=history.flatMap(h=>h.exercises?.filter(e=>e.id===ex.id)??[]);
              const pg=getProgression(eh,ex.reps,ex.weight);
              const firstWorkingSet=(ex.setTypePerSet||[]).findIndex(t=>t==="normal"||t==="drop");
              const displayWeight=firstWorkingSet>=0?((ex.weightPerSet||[])[firstWorkingSet]??ex.weight):ex.weight;
              const displayReps=firstWorkingSet>=0?((ex.repsPerSet||[])[firstWorkingSet]??ex.reps):ex.reps;
              return(
                <div key={ex.id} className="ex-row" style={{alignItems:"center"}}>
                  <div style={{fontWeight:500,flex:1}}>{ex.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    {pg?.type==="increase"&&<span className="prog-pill">+{pg.amount}kg</span>}
                    <span style={{fontSize:12,color:"var(--muted2)",whiteSpace:"nowrap"}}>{displayWeight}kg &times; {displayReps}</span>
                  </div>
                </div>
              );
            })}</div>
            <button className="btn-accent" onClick={()=>setActiveWorkout(todayDay)}>START WORKOUT</button>
          </>:(()=>{
            let nextDay=null,nextIn=0;
            for(let i=1;i<=program.length;i++){const idx=(todayIdx+i)%program.length;if(!program[idx].isRest&&program[idx].exercises.length>0){nextDay=program[idx];nextIn=i;break;}}
            return(<div style={{marginTop:8}}>
              <p style={{color:"var(--muted2)",fontSize:14,margin:"0 0 6px"}}>Recovery is part of the process. Rest up.</p>
              {nextDay&&<p style={{fontSize:12,color:"var(--muted2)",margin:0}}>Next up in {nextIn} day{nextIn>1?"s":""}: <span style={{color:nextDay.color,fontWeight:600}}>{nextDay.label}</span> &bull; {nextDay.exercises.length} exercises</p>}
            </div>);
          })()}
        </div>
        <MiniCalendar program={program} history={history} todayIdx={todayIdx} startDate={ls.get("gr_start",null)} onExpand={()=>setCalMode("workout")}/>
        <div>
          <div className="ctitle">RECENT WORKOUTS</div>
          {history.length===0
            ? <p style={{fontSize:13,color:"var(--muted)",textAlign:"center",padding:"20px 0"}}>No sessions logged yet.</p>
            : [...history].reverse().map((s,i)=>{
                const day=program.find(d=>d.id===s.dayKey);
                return(
                  <div key={i} className="hist-card" onClick={()=>setHistDetail(s)} style={{margin:"0 0 8px",padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:13,color:day?.color}}>{day?.label??s.dayKey}</div>
                        <div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>
                          {new Date(s.date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} &bull; {s.duration}min{s.exercises?.length?` · ${s.exercises.length} ex`:""}
                        </div>
                      </div>
                      <div style={{fontSize:14,color:"var(--muted)"}}>&#8250;</div>
                    </div>
                  </div>
                );
              })
          }
        </div>
        <div className="card" style={{marginTop:4}}>
          <div className="ctitle">STATISTICS</div>
          <StatsTab history={history} program={program} trackerGoals={trackerGoals} trackerLogs={trackerLogs}/>
        </div>
      </div>
    </>);
    })()}

    {tab==="workout"&&<>
      <div className="phdr"><h1>PROGRAM</h1></div>
      <div className="scroll">
        {program.map((day,i)=>{
          const isT=i===todayIdx;
          const isActive=!day.isRest&&day.exercises.length>0;
          const totalSets=day.exercises.reduce((s,ex)=>s+ex.sets,0);
          const avgRest=day.exercises.length?Math.round(day.exercises.reduce((s,ex)=>s+(ex.rest??120),0)/day.exercises.length):120;
          const estMins=day.exercises.length?Math.round(totalSets*2.2+totalSets*avgRest/60):0;
          const lastDone=[...history].reverse().find(h=>h.dayKey===day.id);
          const lastDoneLabel=lastDone?new Date(lastDone.date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):null;
          return(<div key={day.id} ref={isT?todayCardRef:undefined} className={`prog-day-card${isT?" prog-day-card-today":""}`} style={{borderLeft:isT?`3px solid ${day.color}`:undefined,background:isT?`${day.color}0c`:undefined}}
            draggable onDragStart={e=>onDragStart(e,i)} onDragEnter={e=>onDragEnter(e,i)} onDragOver={onDragOver} onDrop={e=>onDrop(e,i)} onDragEnd={onDragEnd}>
            <div className="prog-day-header">
              <div className="drag-handle"><Ic.Grip/></div>
              <div className="prog-day-dot" style={{background:day.isRest?"var(--border2)":day.color}}/>
              <div className="prog-day-name" style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span>{day.label}</span>
                  {isT&&<span style={{fontSize:10,color:day.color,background:day.color+"22",padding:"2px 7px",borderRadius:20}}>TODAY</span>}
                  {isActive&&<span style={{fontSize:10,color:"var(--muted2)",background:"var(--s3)",padding:"2px 7px",borderRadius:20}}>{day.exercises.length} ex · {totalSets} sets · ~{estMins}min</span>}
                </div>
                {lastDoneLabel&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Last done: {lastDoneLabel}</div>}
              </div>
              <button className="btn-icon" onClick={()=>setEditingDay({...day,exercises:day.exercises.map(ex=>({...ex,setTypePerSet:ex.setTypePerSet||Array(ex.sets).fill("normal"),repsPerSet:ex.repsPerSet||Array(ex.sets).fill(ex.reps),weightPerSet:ex.weightPerSet||Array(ex.sets).fill(ex.weight),restPerSet:ex.restPerSet||Array(ex.sets).fill(ex.rest??120)}))})}><Ic.Edit/></button>
            </div>
            {day.exercises.map(ex=>{
              const lastEx=lastDone?.exercises?.find(e=>e.id===ex.id);
              const lastW=lastEx?.sets?.find(s=>!s.skipped)?.weight??null;
              const up=lastW!==null&&ex.weight>parseFloat(lastW);
              const down=lastW!==null&&ex.weight<parseFloat(lastW);
              return(<div key={ex.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,padding:"5px 14px",borderBottom:"1px solid var(--border)"}}>
                <span>{ex.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  {up&&<span style={{fontSize:11,color:"var(--green)",fontWeight:800}}>↑</span>}
                  {down&&<span style={{fontSize:11,color:"#e24b4a",fontWeight:800}}>↓</span>}
                  <span style={{color:"var(--muted)"}}>{ex.sets}×{ex.reps} · {ex.weight}kg</span>
                </div>
              </div>);
            })}
            {isActive&&<button className="btn-accent" style={{margin:10,width:"calc(100% - 20px)",fontSize:15,padding:10}} onClick={()=>setActiveWorkout(day)}>START</button>}
            {day.isRest&&<div style={{padding:"8px 14px 10px",fontSize:13,color:"var(--muted)"}}>Rest day &mdash; edit to add exercises.</div>}
          </div>);
        })}
        <button className="btn-accent" style={{background:"var(--s2)",color:"var(--muted2)",border:"1px solid var(--border)"}} onClick={addDay}>+ ADD DAY</button>
      </div>
    </>}

    {tab==="tracker"&&<TrackerTab goals={trackerGoals} setGoals={setTrackerGoals} logs={trackerLogs} setLogs={setTrackerLogs} meals={meals} setMeals={setMeals} onOpenCalendar={()=>setCalMode("tracker")}/>}

    {tab==="chat"&&<TrainerChat history={history} program={program} user={user} chatSessions={chatSessions} onSessionsChange={setChatSessions} onProgramChange={setProgram} trackerGoals={trackerGoals} trackerLogs={trackerLogs} meals={meals} streak={streak} totalSessions={totalSessions}/>}

    {tab==="settings"&&<>
      <div className="phdr"><h1>SETTINGS</h1></div>
      <div className="scroll">
        <div className="card">
          <div className="ctitle" style={{fontSize:14}}>ACCOUNT</div>
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0 4px"}}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#fff",flexShrink:0,letterSpacing:0}}>
              {(user.name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:2}}>{user.name}</div>
              <div style={{fontSize:12,color:"var(--muted2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
            </div>
            <button className="btn-ghost" onClick={()=>{setUser(null);ls.set("gr_user",null);}}>Sign out</button>
          </div>
        </div>
        <div className="card">
          <div className="ctitle" style={{fontSize:14}}>APPEARANCE</div>
          <div className="slbl" style={{marginBottom:10}}>Color theme</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {THEMES.map(t=>(
              <button key={t.id} onClick={()=>{setTheme(t.id);ls.set("gr_theme",t.id);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,background:theme===t.id?"var(--s3)":"var(--s2)",border:theme===t.id?"1.5px solid var(--accent2)":"1px solid var(--border2)",borderRadius:12,padding:"10px 14px",cursor:"pointer",minWidth:64,transition:"all .15s"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${t.accent},${t.accent2})`,boxShadow:theme===t.id?`0 0 10px ${t.accent}88`:"none"}}/>
                <span style={{fontSize:11,fontWeight:700,color:theme===t.id?"var(--accent2)":"var(--muted2)"}}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card"><div className="ctitle" style={{fontSize:14}}>WORKOUT</div>
          <div className="srow"><div><div className="slbl">Rest timer between sets</div><div className="ssub">Countdown after each set</div></div><button className={`tog ${restEnabled?"on":""}`} onClick={()=>setRestEnabled(v=>!v)}/></div>
          <div className="srow"><div><div className="slbl">Schedule start date</div><div className="ssub">First day of your program cycle</div></div><input type="date" defaultValue={ls.get("gr_start","")?.slice(0,10)} onChange={e=>ls.set("gr_start",new Date(e.target.value).toISOString())} style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",padding:"6px 8px",fontSize:13}}/></div>
        </div>
        <div className="card"><div className="ctitle" style={{fontSize:14}}>DATA</div>
          <div className="srow"><div><div className="slbl">Export all data</div><div className="ssub">Download as JSON file</div></div><button className="btn-ghost" onClick={()=>{const blob=new Blob([JSON.stringify({history,program,trackerGoals,trackerLogs,meals},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="grind-data.json";a.click();URL.revokeObjectURL(url);}}>Export</button></div>
          <div className="srow"><div><div className="slbl">Clear all history</div><div className="ssub">Cannot be undone</div></div><button className="btn-danger" onClick={()=>{if(window.confirm("Delete all history?"))setHistory([]);}}>Clear</button></div>
          <div className="srow"><div><div className="slbl">Reset program to default</div></div><button className="btn-danger" onClick={()=>{if(window.confirm("Reset program?"))setProgram(DEFAULT_PROGRAM);}}>Reset</button></div>
        </div>
      </div>
    </>}

    </div>
    <nav className="bnav">{[{id:"home",label:"Home",icon:<Ic.Home/>},{id:"workout",label:"Program",icon:<Ic.Dumbbell/>},{id:"tracker",label:"Track",icon:<Ic.Target/>},{id:"chat",label:"Trainer",icon:<Ic.Chat/>},{id:"settings",label:"Settings",icon:<Ic.Cog/>}].map(n=>(<button key={n.id} className={`nbtn ${tab===n.id?"on":""}`} onClick={()=>switchTab(n.id)}>{n.icon}{n.label}</button>))}</nav>

    {editingDay&&<DayEditor day={editingDay} onClose={()=>setEditingDay(null)}
      onSave={upd=>{ const hasEx=upd.exercises.length>0; updateDay(editingDay.id,{...upd,isRest:!hasEx}); setEditingDay(null); }}
      onUpdateEx={(eid,ch)=>{ updateEx(editingDay.id,eid,ch); setEditingDay(d=>({...d,exercises:d.exercises.map(e=>e.id===eid?{...e,...ch}:e)})); }}
      onAddEx={()=>{ const newEx={id:uid(),name:"New Exercise",sets:3,reps:10,rest:120,weight:20,setTypePerSet:["normal","normal","normal"],repsPerSet:[10,10,10],weightPerSet:[20,20,20],restPerSet:[120,120,120]}; addEx(editingDay.id); setEditingDay(d=>({...d,isRest:false,exercises:[...d.exercises,newEx]})); }}
      onRemoveEx={eid=>{ removeEx(editingDay.id,eid); setEditingDay(d=>{ const exs=d.exercises.filter(e=>e.id!==eid); return{...d,exercises:exs,isRest:exs.length===0}; }); }}
      onDelete={()=>{ setProgram(p=>p.filter(d=>d.id!==editingDay.id)); setEditingDay(null); }}
    />}
  </div><SpeedInsights/></>);
}
