import { useState, useEffect, useRef, useCallback } from "react";

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

function MiniCalendar({program, history, todayIdx, startDate}) {
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
        {weekOffset !== 0 && (
          <button onClick={()=>setWeekOffset(0)} style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:6,padding:"2px 8px",cursor:"pointer",color:"var(--muted)",fontSize:11}}>NOW</button>
        )}
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
                <div style={{fontFamily:"var(--df)",fontSize:14,color:letterColor,lineHeight:1}}>{letter}</div>
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
    { type:"normal",  label:"Normal",   badge:"1", color:"#FF6B35", bg:"rgba(255,107,53,.15)" },
    { type:"warmup",  label:"Warm-up",  badge:"W", color:"#f59e0b", bg:"rgba(245,158,11,.15)" },
    { type:"drop",    label:"Drop set", badge:"D", color:"#a78bfa", bg:"rgba(167,139,250,.15)" },
  ];

  return (
    <>
      <div ref={btnRef} onClick={handleOpen}
        style={{width:32,height:32,borderRadius:8,background:typeBg,border:`1.5px solid ${typeColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--df)",fontSize:16,color:typeColor,cursor:"pointer",userSelect:"none",flexShrink:0,transition:"all .15s"}}>
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
.btn-icon{background:none;border:none;cursor:pointer;color:var(--muted2);padding:6px;display:flex;align-items:center;border-radius:6px;}
.btn-icon:hover{color:var(--text);background:var(--s2);}
.day-badge{display:inline-block;font-family:var(--df);font-size:12px;letter-spacing:2px;padding:3px 10px;border-radius:20px;margin-bottom:6px;}
.day-label{font-family:var(--df);font-size:34px;letter-spacing:2px;margin-bottom:4px;}
.ex-preview{display:flex;flex-direction:column;gap:5px;margin:10px 0;}
.ex-row{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--s2);border-radius:8px;font-size:13px;}
.prog-pill{font-size:10px;padding:2px 7px;border-radius:20px;background:var(--gbg);color:#88cc88;border:1px solid var(--gborder);white-space:nowrap;}
.stats-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
.stat-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;}
.stat-lbl{font-size:10px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px;}
.stat-num{font-family:var(--df);font-size:38px;letter-spacing:1px;line-height:1;}
.hdr-row{display:flex;justify-content:space-between;align-items:center;}
.streak-chip{display:flex;align-items:center;gap:5px;font-family:var(--df);font-size:15px;letter-spacing:1px;padding:6px 13px;background:var(--s2);border-radius:20px;border:1px solid var(--border);}
.w-header{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--s1);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;}
.back-btn{width:36px;height:36px;background:var(--s2);border:1px solid var(--border);border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text);flex-shrink:0;}
.ex-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);margin:0 14px 12px;overflow:hidden;transition:border-color .2s,background .3s;}
.ex-card.ex-done{border-color:var(--gborder);background:rgba(13,32,13,.4);}
.ex-card.ex-skip{opacity:.4;}
.ex-chead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);}
.ex-cname{font-weight:600;font-size:15px;}
.ex-cmeta{color:var(--muted);font-size:12px;margin-top:2px;}
.ai-banner{margin:0 14px 10px;padding:10px 13px;border-radius:10px;font-size:13px;line-height:1.5;border-left:2.5px solid var(--accent);background:#1a1008;color:#ffcc88;}
.ai-banner.good{border-color:var(--green);background:var(--gbg);color:#88cc88;}
.set-table{width:100%;border-collapse:collapse;}
.set-table-head th{font-size:10px;color:var(--muted);font-weight:500;letter-spacing:.5px;text-transform:uppercase;padding:7px 6px;text-align:center;border-bottom:1px solid var(--border);}
.set-table-head th:first-child{text-align:left;padding-left:14px;}
.set-row{border-bottom:1px solid var(--border);transition:background .15s;}
.set-row:last-child{border-bottom:none;}
.set-row td{padding:7px 5px;text-align:center;vertical-align:middle;}
.set-row.row-done{background:rgba(13,32,13,.5);}
.set-row.row-warmup{background:rgba(245,158,11,.05);}
.set-row.row-drop{background:rgba(167,139,250,.05);}
.set-row.row-skip{opacity:.3;}
.set-field{background:var(--s3);border:1.5px solid var(--border2);border-radius:8px;color:var(--text);font-size:16px;font-weight:600;text-align:center;padding:6px 2px;width:58px;outline:none;font-family:var(--db);transition:border-color .15s,background .15s,color .15s;}
.set-field:focus{border-color:var(--accent);}
.set-row.row-done .set-field{border-color:var(--gborder);background:#0a1a0a;color:#88cc88;}
.set-check{width:34px;height:34px;border-radius:50%;border:2px solid var(--border2);background:var(--s3);display:flex;align-items:center;justify-content:center;cursor:pointer;margin:0 auto;transition:all .15s;}
.set-check.checked{background:#1a4a1a;border-color:var(--green);}
.set-prev{font-size:11px;color:var(--muted2);white-space:nowrap;}
.set-skip-x{width:20px;height:20px;border-radius:4px;background:var(--s3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);cursor:pointer;flex-shrink:0;}
.add-set-btn{width:100%;padding:10px;background:none;border:none;color:var(--muted2);font-family:var(--db);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid var(--border);}
.add-set-btn:hover{color:var(--text);}
.set-type-chip{font-family:var(--df);font-size:15px;width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.type-picker-popup{position:fixed;background:var(--s1);border:1px solid var(--border2);border-radius:12px;z-index:9999;padding:5px;min-width:130px;box-shadow:0 8px 24px rgba(0,0,0,.7);}
.type-picker-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;}
.type-picker-item:hover{background:var(--s2);}
.type-picker-badge{font-family:var(--df);font-size:15px;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.prog-day-actions{display:flex;gap:2px;align-items:center;}
.rest-overlay{position:fixed;inset:0;background:rgba(0,0,0,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:200;}
.rest-lbl{font-family:var(--df);font-size:16px;letter-spacing:4px;color:var(--muted);margin-bottom:6px;}
.rest-num{font-family:var(--df);font-size:100px;letter-spacing:3px;line-height:1;}
.rest-skip{margin-top:28px;padding:13px 36px;background:var(--s2);border:1px solid var(--border);border-radius:var(--r);color:var(--muted2);font-family:var(--df);font-size:15px;letter-spacing:1px;cursor:pointer;}
.note-wrap{padding:0 14px 12px;}
.note-lbl{font-size:12px;color:var(--muted);margin-bottom:5px;}
.note-ta{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:var(--db);font-size:14px;padding:10px 12px;resize:none;min-height:64px;outline:none;}
.finish-btn{display:block;width:calc(100% - 28px);margin:0 14px 14px;padding:15px;background:var(--gbg);border:1px solid var(--gborder);border-radius:var(--r);color:#88cc88;font-family:var(--df);font-size:19px;letter-spacing:2px;cursor:pointer;}
.hist-card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:13px;margin-bottom:9px;cursor:pointer;transition:border-color .15s;}
.hist-card:hover{border-color:var(--border2);}
.hist-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border);}
.hist-row:last-of-type{border-bottom:none;}
.chat-wrap{display:flex;flex-direction:column;height:calc(100dvh - 56px);overflow:hidden;position:relative;}
.chat-msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:8px;min-height:0;-webkit-overflow-scrolling:touch;}
.msg{max-width:86%;}
.msg.user{align-self:flex-end;}
.msg.ai{align-self:flex-start;}
.bubble{padding:10px 13px;border-radius:15px;font-size:14px;line-height:1.6;word-break:break-word;}
.msg.user .bubble{background:var(--accent);color:#fff;border-bottom-right-radius:4px;}
.msg.ai .bubble{background:var(--s2);border:1px solid var(--border);border-bottom-left-radius:4px;}
.msg-time{font-size:10px;color:var(--muted);margin-top:2px;padding:0 3px;}
.chat-bar{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--s1);border-top:1px solid var(--border);padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));min-height:64px;}
.chat-in{flex:1;background:var(--s2);border:1px solid var(--border2);border-radius:22px;color:var(--text);font-size:16px;padding:10px 16px;outline:none;min-width:0;min-height:44px;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text;display:block;box-sizing:border-box;}
.chat-in:focus{border-color:var(--accent);}
.send-btn{width:42px;height:42px;min-width:42px;border-radius:50%;background:var(--accent);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .15s;flex-shrink:0;}
.send-btn:active{opacity:.8;}
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
.drag-handle{cursor:grab;color:var(--muted);padding:4px 6px;display:flex;align-items:center;touch-action:none;user-select:none;}
.drag-handle:active{cursor:grabbing;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:300;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:var(--s1);border-radius:20px 20px 0 0;padding:20px;width:100%;max-width:430px;max-height:90svh;overflow-y:auto;}
.modal-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.modal-title{font-family:var(--df);font-size:22px;letter-spacing:1px;}
.form-lbl{font-size:12px;color:var(--muted);margin-bottom:5px;}
.form-input{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:9px;color:var(--text);font-family:var(--db);font-size:15px;padding:10px 12px;outline:none;}
.mini-input{background:var(--s2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--db);font-size:13px;padding:4px 8px;width:100%;text-align:center;outline:none;}
.login{min-height:100svh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:var(--bg);}
.login-logo{font-family:var(--df);font-size:64px;letter-spacing:5px;color:var(--accent);}
.login-tagline{color:var(--muted2);font-size:15px;margin:6px 0 48px;line-height:1.7;}
.google-btn{display:flex;align-items:center;gap:12px;padding:13px 26px;background:var(--s1);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-family:var(--db);font-size:16px;font-weight:500;cursor:pointer;margin-bottom:14px;}
.demo-lnk{background:none;border:none;color:var(--muted2);font-family:var(--db);font-size:13px;cursor:pointer;text-decoration:underline;margin-top:4px;}
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
          const typeColor = isW ? "#f59e0b" : isD ? "#a78bfa" : s.done ? "#4CAF50" : "var(--accent)";
          const typeBg   = isW ? "rgba(245,158,11,.18)" : isD ? "rgba(167,139,250,.18)" : s.done ? "rgba(76,175,80,.18)" : "var(--s3)";
          return (
            <tr key={si} className={`set-row ${s.done?"row-done":""} ${s.skipped?"row-skip":""} ${isW&&!s.done?"row-warmup":""} ${isD&&!s.done?"row-drop":""}`}>
              <td style={{paddingLeft:14,paddingRight:4,width:44}}>
                {editable && onTypeSelect
                  ? <SetTypePicker sets={sets} si={si} onSelect={t=>onTypeSelect(si,t)}/>
                  : <div style={{width:32,height:32,borderRadius:8,background:typeBg,border:`1.5px solid ${typeColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--df)",fontSize:16,color:typeColor,userSelect:"none",flexShrink:0}}>{label}</div>
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
    <div style={{fontFamily:"var(--df)",fontSize:15,letterSpacing:1,margin:"16px 0 8px"}}>EXERCISES</div>
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
        <div style={{fontFamily:"var(--df)",fontSize:20,letterSpacing:1}}>{fmtTime(elapsed)}</div>
      </div>
      <div style={{flex:1,padding:"10px 16px"}}>
        <div style={{fontSize:10,color:"var(--muted)",letterSpacing:.4,textTransform:"uppercase",marginBottom:2}}>Volume</div>
        <div style={{fontFamily:"var(--df)",fontSize:20,letterSpacing:1}}>{totalVol > 0 ? `${totalVol.toLocaleString()}kg` : "--"}</div>
      </div>
    </div>
  );
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
  const handleFinish=()=>{const duration=Math.round((Date.now()-startTime.current)/60000);onFinish({date:new Date().toISOString(),dayKey:workout.id,duration,note,exercises:exStates});};
  return(<div style={{display:"flex",flexDirection:"column",minHeight:"100svh"}}>
    <div className="w-header">
      <button className="back-btn" onClick={onBack}><Ic.Back/></button>
      <div style={{flex:1}}><div style={{fontFamily:"var(--df)",fontSize:21,letterSpacing:1.5}}>{workout.label}</div><div style={{fontSize:12,color:"var(--muted)"}}>{exStates.filter(e=>!e.skipped).length} exercises</div></div>
      <button className="finish-btn" style={{width:"auto",margin:0,padding:"8px 18px",fontSize:15,letterSpacing:1}} onClick={handleFinish}>{allDone?"DONE":"FINISH"}</button>
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
      <div className="note-wrap" style={{marginTop:8}}>
        <div className="note-lbl">Session note (optional)</div>
        <textarea className="note-ta" placeholder="Feeling a bit tired today..." value={note} onChange={e=>setNote(e.target.value)}/>
      </div>
      <button className="finish-btn" onClick={handleFinish}>{allDone?"FINISH WORKOUT":"FINISH WORKOUT (EARLY)"}</button>
    </div>
  </div>);
}

function HistoryDetail({session,program,onBack,onDelete}){
  const day=program.find(d=>d.id===session.dayKey);
  return(<div style={{display:"flex",flexDirection:"column",minHeight:"100svh"}}>
    <div className="w-header">
      <button className="back-btn" onClick={onBack}><Ic.Back/></button>
      <div style={{flex:1}}>
        <div style={{fontFamily:"var(--df)",fontSize:21,letterSpacing:1.5,color:day?.color??undefined}}>{day?.label??session.dayKey}</div>
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

function TrainerChat({history,program,user}){
  const [msgs,setMsgs]=useState([{role:"ai",text:`Hey ${user?.name?.split(" ")[0]??"there"}! I'm your personal trainer. I know all your workout data. Ask me anything!`,time:nowT()}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  function nowT(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
  const send=async()=>{
    if(!input.trim()||loading)return;
    const text=input.trim(); setInput("");
    setMsgs(m=>[...m,{role:"user",text,time:nowT()}]); setLoading(true);
    const progSum=program.filter(d=>!d.isRest).map(d=>({name:d.label,exercises:d.exercises.map(e=>`${e.name} ${e.sets}x${e.reps} @ ${e.weight}kg`)}));
    const hist=history.slice(-15).map(s=>({date:s.date?.slice(0,10),day:s.dayKey,duration:s.duration,note:s.note,exercises:s.exercises?.map(e=>({name:e.name,weight:e.weight,sets:e.sets?.map(st=>st.skipped?"skip":(st.reps||"?"))}))}));
    const sys = `
You are a personal gym trainer AI.
Always respond in English unless the user writes in another language.
Rules: concise (3-5 sentences), no filler, specific recommendations.

Program: ${JSON.stringify(progSum)}
Last 15 sessions: ${JSON.stringify(hist)}
`;
    try{
      const apiBase=import.meta.env.VITE_API_URL??"";
      const r=await fetch(`${apiBase}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemPrompt:sys,messages:[...msgs.slice(1),{role:"user",text}]})});
      const d=await r.json();
      setMsgs(m=>[...m,{role:"ai",text:d.reply??"Connection error.",time:nowT()}]);
    }catch(e){ console.error("[chat] fetch error:",e); setMsgs(m=>[...m,{role:"ai",text:"Connection error!",time:nowT()}]); }
    setLoading(false);
  };
  return(
    <div className="chat-wrap">
      <div className="phdr"><h1>TRAINER</h1></div>
      <div className="chat-msgs">
        {msgs.map((m,i)=>(<div key={i} className={`msg ${m.role}`}><div className="bubble">{m.text}</div><div className="msg-time">{m.time}</div></div>))}
        {loading&&<div className="msg ai"><div className="bubble"><div className="typing"><div className="dot"/><div className="dot"/><div className="dot"/></div></div></div>}
        <div ref={bottomRef}/>
      </div>
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

export default function App() {
  const [user,          setUser]         = useState(()=>ls.get("gr_user",null));
  const [tab,           setTab]          = useState("home");
  const [history,       setHistory]      = useState(()=>ls.get("gr_history",[]));
  const [program,       setProgram]      = useState(()=>ls.get("gr_program",DEFAULT_PROGRAM));
  const [sheetId,       setSheetId]      = useState(()=>ls.get("gr_sheetId",null));
  const [restEnabled,   setRestEnabled]  = useState(()=>ls.get("gr_rest",true));
  const [activeWorkout, setActiveWorkout]= useState(null);
  const [restTimer,     setRestTimer]    = useState(null);
  const [editingDay,    setEditingDay]   = useState(null);
  const [histDetail,    setHistDetail]   = useState(null);
  const restRef = useRef(null);

  useEffect(()=>{ls.set("gr_history",history);},[history]);
  useEffect(()=>{ls.set("gr_program",program);},[program]);
  useEffect(()=>{ls.set("gr_rest",restEnabled);},[restEnabled]);
  useEffect(()=>{if(user)ls.set("gr_user",user);},[user]);

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
    setRestTimer(secs);
    clearInterval(restRef.current);
    restRef.current=setInterval(()=>{
      setRestTimer(t=>{ if(t<=1){clearInterval(restRef.current);return null;} return t-1; });
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
  const handleConnectSheets=async()=>{ if(!user?.accessToken)return alert("Sign in with Google first."); try{ const r=await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",accessToken:user.accessToken})}); const d=await r.json(); if(d.spreadsheetId){setSheetId(d.spreadsheetId);ls.set("gr_sheetId",d.spreadsheetId);alert("Google Sheet created!");} }catch{alert("Error.");} };
  const handleCalendar=async()=>{ if(!user?.accessToken)return alert("Sign in with Google first."); const r=await fetch("/api/calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:user.accessToken,startDate:ls.get("gr_start",new Date().toISOString())})}); const d=await r.json(); if(d.ok)alert(`${d.eventsCreated} calendar reminders added!`); };

  const totalSessions=history.filter(h=>!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const weekStart=new Date(); weekStart.setDate(weekStart.getDate()-todayIdx); weekStart.setHours(0,0,0,0);
  const thisWeek=history.filter(h=>new Date(h.date)>=weekStart&&!program.find(d=>d.id===h.dayKey)?.isRest).length;
  const streak=calcStreak(history,program);
  const {onDragStart,onDragEnter,onDragOver,onDrop,onDragEnd}=useDragList(program,moveDay);

  if(!user) return(<><style>{CSS}</style><div className="login">
    <div className="login-logo">GRIND</div>
    <p className="login-tagline">Your free AI personal trainer.<br/>Track. Progress. Never skip leg day.</p>
    <button className="google-btn" onClick={handleLogin}><Ic.Google/> Continue with Google</button>
    <button className="demo-lnk" onClick={handleDemo}>Try without signing in</button>
  </div></>);

  if(activeWorkout) return(<><style>{CSS}</style><div className="app">
    <WorkoutSession workout={activeWorkout} history={history} onFinish={handleFinish} onBack={()=>setActiveWorkout(null)} startRest={startRest} restEnabled={restEnabled}/>
    {restTimer!==null&&(<div className="rest-overlay"><div className="rest-lbl">REST</div><div className="rest-num" style={{color:restTimer<=10?"var(--accent)":"var(--text)"}}>{restTimer}</div><button className="rest-skip" onClick={()=>{clearInterval(restRef.current);setRestTimer(null);}}>SKIP REST</button></div>)}
  </div></>);

  if(histDetail) return(<><style>{CSS}</style><div className="app">
    <HistoryDetail session={histDetail} program={program} onBack={()=>setHistDetail(null)} onDelete={()=>{setHistory(h=>h.filter(s=>!(s.date===histDetail.date&&s.dayKey===histDetail.dayKey)));setHistDetail(null);}}/>
  </div></>);

  return(<><style>{CSS}</style><div className="app">

    {tab==="home"&&<>
      <div className="phdr"><div className="hdr-row"><div><h1>GRIND</h1><p>Hey {user.name?.split(" ")[0]}!</p></div><div className="streak-chip">&#x1F525; {streak}</div></div></div>
      <div className="scroll">
        <div className="stats-row">
          <div className="stat-card"><div className="stat-lbl">Total sessions</div><div className="stat-num">{totalSessions}</div></div>
          <div className="stat-card"><div className="stat-lbl">This week</div><div className="stat-num">{thisWeek}</div></div>
        </div>
        <div className="card" style={{borderColor:todayDay.color+"55"}}>
          <div className="day-badge" style={{background:todayDay.color+"22",color:todayDay.color}}>TODAY</div>
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
          </>:<p style={{color:"var(--muted2)",marginTop:8,fontSize:14}}>Recovery is part of the process. Rest up.</p>}
        </div>
        <MiniCalendar program={program} history={history} todayIdx={todayIdx} startDate={ls.get("gr_start",null)}/>
      </div>
    </>}

    {tab==="workout"&&<>
      <div className="phdr"><h1>PROGRAM</h1></div>
      <div className="scroll">
        {program.map((day,i)=>{
          const isT=i===todayIdx;
          const isActive=!day.isRest&&day.exercises.length>0;
          return(<div key={day.id} className="prog-day-card" style={{borderColor:isT?day.color:undefined}}
            draggable onDragStart={e=>onDragStart(e,i)} onDragEnter={e=>onDragEnter(e,i)} onDragOver={onDragOver} onDrop={e=>onDrop(e,i)} onDragEnd={onDragEnd}>
            <div className="prog-day-header">
              <div className="drag-handle"><Ic.Grip/></div>
              <div className="prog-day-dot" style={{background:day.isRest?"var(--border2)":day.color}}/>
              <div className="prog-day-name">{day.label}{isT&&<span style={{fontSize:10,color:day.color,marginLeft:8,background:day.color+"22",padding:"2px 7px",borderRadius:20}}>TODAY</span>}</div>
              <button className="btn-icon" onClick={()=>setEditingDay({...day,exercises:day.exercises.map(ex=>({...ex,setTypePerSet:ex.setTypePerSet||Array(ex.sets).fill("normal"),repsPerSet:ex.repsPerSet||Array(ex.sets).fill(ex.reps),weightPerSet:ex.weightPerSet||Array(ex.sets).fill(ex.weight),restPerSet:ex.restPerSet||Array(ex.sets).fill(ex.rest??120)}))})}><Ic.Edit/></button>
            </div>
            {day.exercises.map(ex=>(<div key={ex.id} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"5px 14px",borderBottom:"1px solid var(--border)"}}><span>{ex.name}</span><span style={{color:"var(--muted)"}}>{ex.sets}x{ex.reps} &bull; {ex.weight}kg</span></div>))}
            {isActive&&<button className="btn-accent" style={{margin:10,width:"calc(100% - 20px)",fontSize:15,padding:10}} onClick={()=>setActiveWorkout(day)}>START</button>}
            {day.isRest&&<div style={{padding:"8px 14px 10px",fontSize:13,color:"var(--muted)"}}>Rest day &mdash; edit to add exercises.</div>}
          </div>);
        })}
        <button className="btn-accent" style={{background:"var(--s2)",color:"var(--muted2)",border:"1px solid var(--border)"}} onClick={addDay}>+ ADD DAY</button>
      </div>
    </>}

    {tab==="history"&&<>
      <div className="phdr"><h1>HISTORY</h1><p>{totalSessions} sessions</p></div>
      <div className="scroll">
        {history.length===0&&<p style={{textAlign:"center",color:"var(--muted)",marginTop:40}}>No sessions yet</p>}
        {[...history].reverse().map((s,i)=>{ const day=program.find(d=>d.id===s.dayKey); return(<div key={i} className="hist-card" onClick={()=>setHistDetail(s)}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <div><div style={{fontWeight:600,color:day?.color}}>{day?.label??s.dayKey}</div><div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{new Date(s.date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})} &bull; {s.duration}min</div></div>
            <div style={{fontSize:11,color:"var(--muted)",alignSelf:"center"}}>View &#8250;</div>
          </div>
          {s.exercises?.filter(e=>!e.skipped).slice(0,3).map((ex,j)=>(<div key={j} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--muted2)",padding:"2px 0"}}><span>{ex.name}</span><span>{ex.weight}kg &bull; {ex.sets?.filter(st=>!st.skipped&&st.reps).map(st=>st.reps).join("/")}</span></div>))}
          {s.exercises?.filter(e=>!e.skipped).length>3&&<div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>+{s.exercises.filter(e=>!e.skipped).length-3} more</div>}
          {s.note&&<div style={{marginTop:6,fontSize:12,color:"var(--muted2)",fontStyle:"italic"}}>&ldquo;{s.note}&rdquo;</div>}
        </div>); })}
      </div>
    </>}

    {tab==="chat"&&<TrainerChat history={history} program={program} user={user}/>}

    {tab==="settings"&&<>
      <div className="phdr"><h1>SETTINGS</h1><p>{user.email}</p></div>
      <div className="scroll">
        <div className="card"><div className="ctitle" style={{fontSize:14}}>ACCOUNT</div><div className="srow"><div><div className="slbl">{user.name}</div><div className="ssub">{user.email}</div></div><button className="btn-ghost" onClick={()=>{setUser(null);ls.set("gr_user",null);}}>Sign out</button></div></div>
        <div className="card"><div className="ctitle" style={{fontSize:14}}>GOOGLE INTEGRATION</div><p style={{fontSize:13,color:"var(--muted2)",marginBottom:12,lineHeight:1.6}}>Sync workouts to Google Sheets and add calendar reminders.</p><button className="btn-accent" style={{fontSize:15,padding:12,marginBottom:8}} onClick={handleConnectSheets}>{sheetId?"SHEETS CONNECTED":"CONNECT GOOGLE SHEETS"}</button><button className="btn-accent" style={{fontSize:15,padding:12,background:"#1a2a3a",color:"#88aacc"}} onClick={handleCalendar}>SET UP CALENDAR REMINDERS</button></div>
        <div className="card"><div className="ctitle" style={{fontSize:14}}>WORKOUT</div>
          <div className="srow"><div><div className="slbl">Rest timer between sets</div><div className="ssub">Countdown after each set</div></div><button className={`tog ${restEnabled?"on":""}`} onClick={()=>setRestEnabled(v=>!v)}/></div>
          <div className="srow"><div><div className="slbl">Schedule start date</div><div className="ssub">First day of your program cycle</div></div><input type="date" defaultValue={ls.get("gr_start","")?.slice(0,10)} onChange={e=>ls.set("gr_start",new Date(e.target.value).toISOString())} style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:8,color:"var(--text)",padding:"6px 8px",fontSize:13}}/></div>
        </div>
        <div className="card"><div className="ctitle" style={{fontSize:14}}>DATA</div><div className="srow"><div><div className="slbl">Clear all history</div><div className="ssub">Cannot be undone</div></div><button className="btn-danger" onClick={()=>{if(window.confirm("Delete all history?"))setHistory([]);}}>Clear</button></div><div className="srow"><div><div className="slbl">Reset program to default</div></div><button className="btn-danger" onClick={()=>{if(window.confirm("Reset program?"))setProgram(DEFAULT_PROGRAM);}}>Reset</button></div></div>
      </div>
    </>}

    <nav className="bnav">{[{id:"home",label:"Home",icon:<Ic.Home/>},{id:"workout",label:"Program",icon:<Ic.Dumbbell/>},{id:"history",label:"History",icon:<Ic.Clock/>},{id:"chat",label:"Trainer",icon:<Ic.Chat/>},{id:"settings",label:"Settings",icon:<Ic.Cog/>}].map(n=>(<button key={n.id} className={`nbtn ${tab===n.id?"on":""}`} onClick={()=>setTab(n.id)}>{n.icon}{n.label}</button>))}</nav>

    {editingDay&&<DayEditor day={editingDay} onClose={()=>setEditingDay(null)}
      onSave={upd=>{ const hasEx=upd.exercises.length>0; updateDay(editingDay.id,{...upd,isRest:!hasEx}); setEditingDay(null); }}
      onUpdateEx={(eid,ch)=>{ updateEx(editingDay.id,eid,ch); setEditingDay(d=>({...d,exercises:d.exercises.map(e=>e.id===eid?{...e,...ch}:e)})); }}
      onAddEx={()=>{ const newEx={id:uid(),name:"New Exercise",sets:3,reps:10,rest:120,weight:20,setTypePerSet:["normal","normal","normal"],repsPerSet:[10,10,10],weightPerSet:[20,20,20],restPerSet:[120,120,120]}; addEx(editingDay.id); setEditingDay(d=>({...d,isRest:false,exercises:[...d.exercises,newEx]})); }}
      onRemoveEx={eid=>{ removeEx(editingDay.id,eid); setEditingDay(d=>{ const exs=d.exercises.filter(e=>e.id!==eid); return{...d,exercises:exs,isRest:exs.length===0}; }); }}
      onDelete={()=>{ setProgram(p=>p.filter(d=>d.id!==editingDay.id)); setEditingDay(null); }}
    />}
  </div></>);
}
