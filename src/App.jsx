import { useEffect, useMemo, useRef, useState } from 'react'

function useSounds() {
  const ctxRef = useRef(null)
  const ambientRef = useRef(null)
  const bgmRef = useRef(null)
  const ensure = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    return ctxRef.current
  }
  const beep = (freq = 600, dur = 0.06, type = 'sine', gain = 0.03) => {
    const ctx = ensure()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.value = gain
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur)
  }
  const playTick = () => beep(800, 0.06, 'square', 0.025)
  const playWin = () => { beep(740, 0.08, 'triangle', 0.04); setTimeout(() => beep(880, 0.1, 'triangle', 0.04), 90) }
  const playFail = () => beep(180, 0.12, 'sawtooth', 0.035)
  const playArabicClick = () => { beep(700, 0.05, 'triangle', 0.045); setTimeout(() => beep(980, 0.06, 'square', 0.032), 50) }
  const playKeyClick = () => {
    const ctx = ensure()
    const len = Math.floor(ctx.sampleRate * 0.06)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.5))
    const src = ctx.createBufferSource(); src.buffer = buf
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = 8
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07)
    src.connect(filter); filter.connect(g); g.connect(ctx.destination)
    src.start(); src.stop(ctx.currentTime + 0.08)
  }
  const startAmbientForest = () => {
    const ctx = ensure()
    if (ambientRef.current) return
    const master = ctx.createGain(); master.gain.value = 0.12; master.connect(ctx.destination)
    const len = Math.floor(ctx.sampleRate * 2)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i=0;i<len;i++) d[i] = (Math.random()*2 - 1)
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 0.85
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.0001
    const windG = ctx.createGain(); windG.gain.value = 0.08
    noise.connect(bp); bp.connect(lp); lp.connect(windG); windG.connect(master)
    noise.start()
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.05
    lfo.connect(lfoGain); lfoGain.connect(windG.gain); lfo.start()
    const chirpTimer = setInterval(()=>{
      if (Math.random() < 0.45) {
        beep(2400, 0.03, 'square', 0.007)
        setTimeout(()=> beep(2000, 0.05, 'triangle', 0.006), 28)
      }
    }, 3200)

    ambientRef.current = { master, noise, lfo, chirpTimer }
  }
  const stopAmbientForest = () => {
    const a = ambientRef.current
    if (!a) return
    try { a.noise.stop() } catch {}
    try { a.lfo.stop() } catch {}
    try { a.master.disconnect() } catch {}
    clearInterval(a.chirpTimer)
    ambientRef.current = null
  }
  const startBGM = () => {
    const ctx = ensure()
    if (bgmRef.current) return
    const master = ctx.createGain(); master.gain.value = 0.10; master.connect(ctx.destination)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.Q.value = 0.0001; lp.connect(master)
    const oscA = ctx.createOscillator(); oscA.type = 'sine'; oscA.frequency.value = 220
    const oscC = ctx.createOscillator(); oscC.type = 'sine'; oscC.frequency.value = 261.63
    const oscE = ctx.createOscillator(); oscE.type = 'sine'; oscE.frequency.value = 329.63
    const gA = ctx.createGain(); const gC = ctx.createGain(); const gE = ctx.createGain()
    gA.gain.value = 0.12; gC.gain.value = 0.10; gE.gain.value = 0.08
    oscA.connect(gA); oscC.connect(gC); oscE.connect(gE); gA.connect(lp); gC.connect(lp); gE.connect(lp)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 80
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency)
    oscA.start(); oscC.start(); oscE.start(); lfo.start()
    bgmRef.current = { master, lp, oscA, oscC, oscE, lfo }
  }
  const stopBGM = () => {
    const b = bgmRef.current
    if (!b) return
    try { b.oscA.stop() } catch {}
    try { b.oscC.stop() } catch {}
    try { b.oscE.stop() } catch {}
    try { b.lfo.stop() } catch {}
    try { b.master.disconnect() } catch {}
    bgmRef.current = null
  }
  return { playTick, playWin, playFail, playArabicClick, playKeyClick, startAmbientForest, stopAmbientForest, startBGM, stopBGM }
}

function FirefliesOverlay(){
  const flies = useMemo(()=>
    Array.from({length: 22}).map((_,i)=>{
      const r = () => Math.random()
      const s = 0.8 + r()*0.8
      const x0 = Math.round(r()*100)
      const y0 = Math.round(r()*100)
      const x1 = Math.round((x0 + (r()*40-20) + 100) % 100)
      const y1 = Math.round((y0 + (r()*30-15) + 100) % 100)
      const dur = 18 + r()*22
      const delay = -r()*dur
      const fdur = 2 + r()*2.5
      return { id:i, style: {
        '--x0': x0+'vw', '--y0': y0+'vh', '--x1': x1+'vw', '--y1': y1+'vh',
        '--dur': dur+'s', '--delay': delay+'s', '--fdur': fdur+'s', '--s': s
      }}
    })
  ,[])
  return (
    <div className="fireflies">
      {flies.map(f=> <span key={f.id} style={f.style} />)}
    </div>
  )
}

const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
]

function winnerOf(b) {
  for (const [a,c,d] of LINES) if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]
  if (b.every(Boolean)) return 'draw'
  return null
}

function aiMove(board, ai, human) {
  for (let i=0;i<9;i++) if(!board[i]) { const t=[...board]; t[i]=ai; if(winnerOf(t)===ai) return i }
  for (let i=0;i<9;i++) if(!board[i]) { const t=[...board]; t[i]=human; if(winnerOf(t)===human) return i }
  if (!board[4]) return 4
  const corners=[0,2,6,8].filter(i=>!board[i])
  if (corners.length) return corners[Math.floor(Math.random()*corners.length)]
  const sides=[1,3,5,7].filter(i=>!board[i])
  if (sides.length) return sides[Math.floor(Math.random()*sides.length)]
  return -1
}

function NeonTitle({children}){
  return <h1 className="heading-3d-strong font-arabic text-yellow-200 text-4xl md:text-5xl">{children}</h1>
}

function PrimaryButton({children, ...p}){
  return <button {...p} className={(p.className||"") + " bg-transparent px-5 py-3 rounded-md border border-yellow-400 text-yellow-300 hover:bg-yellow-400/10 active:bg-yellow-400/20 drop-shadow-[0_0_8px_#facc15] transition"}>{children}</button>
}

function Radio({checked, onChange, children}){
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <input type="radio" checked={checked} onChange={onChange} className="size-4 accent-yellow-400" />
      <span className="text-sm text-gray-300">{children}</span>
    </label>
  )
}

function Screen({children}){
  return (
    <div className="relative overflow-hidden min-h-screen w-full">
      <div className="app-bg" />
      <div className="fog">
        <div className="fog-1" />
        <div className="fog-2" />
        <div className="fog-3" />
      </div>
      <div className="vignette" />
      <FirefliesOverlay />
      <div className="relative z-10 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}

function StartScreen({onStart, playClick, sfxOn, setSfxOn, ambientOn, setAmbientOn, bgmOn, setBgmOn, sounds}){
  const [open, setOpen] = useState(false)
  return (
    <div className="relative w-full min-h-[70vh] flex items-center justify-center">
      <div className="bg-motion"></div>
      <div className="absolute inset-0 opacity-[.04] bg-[radial-gradient(circle_at_center,rgba(255,255,255,.9)_1px,transparent_1px)] [background-size:22px_22px]"></div>

      <div className="absolute top-4 right-4 z-20">
        <button className="btn-3d-icon" onClick={()=>{ if (sfxOn) sounds.playKeyClick(); setOpen(o=>!o) }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="currentColor"/><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.6-.22l-2.49 1a7.03 7.03 0 0 0-1.7-.98l-.38-2.65A.5.5 0 0 0 13 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.61.24-1.18.56-1.7.98l-2.49-1a.5.5 0 0 0-.6.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.05.32-.07.65-.07.98s.03.66.07.98L1.56 14.63a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .6.22l2.49-1c.52.42 1.09.74 1.7.98l.38 2.65c.04.24.25.42.49.42h4c.24 0 .45-.18.49-.42l.38-2.65c.61-.24 1.18-.56 1.7-.98l2.49 1c.22.09.47 0 .6-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65Z" fill="currentColor"/></svg>
        </button>
        {open && (
          <div className="absolute right-0 mt-2 p-3 bg-black/60 border border-yellow-500/40 rounded-xl backdrop-blur-sm space-y-2 min-w-[220px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-200">Music (BGM)</span>
              <button className={"btn-3d-sm "+(bgmOn?"":"opacity-60")} onClick={()=>{ if (sfxOn) sounds.playKeyClick(); if (!bgmOn) sounds.startBGM(); else sounds.stopBGM(); setBgmOn(!bgmOn); }}>{bgmOn? 'On':'Off'}</button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-200">Sound (Ambient)</span>
              <button className={"btn-3d-sm "+(ambientOn?"":"opacity-60")} onClick={()=>{ if (sfxOn) sounds.playKeyClick(); if (!ambientOn) sounds.startAmbientForest(); else sounds.stopAmbientForest(); setAmbientOn(!ambientOn); }}>{ambientOn? 'On':'Off'}</button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-200">SFX</span>
              <button className={"btn-3d-sm "+(sfxOn?"":"opacity-60")} onClick={()=>{ if (sfxOn) sounds.playKeyClick(); setSfxOn(!sfxOn); }}>{sfxOn? 'On':'Off'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 text-center space-y-10">
        <div className="text-xs tracking-[0.35em] text-gray-300/80 uppercase">Main Menu</div>
        <h1 className="heading-3d-strong font-arabic text-yellow-200 text-5xl md:text-7xl float-slow select-none">Tic Tac Toe</h1>
        <div className="mx-auto max-w-md p-6 bg-black/40 border border-yellow-500/40 rounded-xl backdrop-blur-sm shadow-[0_0_40px_rgba(250,204,21,.15)]">
          <button className="btn-3d w-full font-arabic" onClick={()=>{ if (sfxOn) playClick?.(); onStart(); }}>{"Start"}</button>
          <div className="mt-4 text-xs text-gray-400">Press Start to continue</div>
        </div>
      </div>
    </div>
  )
}

function App(){
  const [screen,setScreen] = useState('start')
  const [name,setName] = useState('Player')
  const [mode,setMode] = useState('single')
  const [hostMode,setHostMode] = useState('host')
  const [room,setRoom] = useState(() => Math.random().toString(36).slice(2,7).toUpperCase())
  const [piece,setPiece] = useState('X')
  const [sfxOn, setSfxOn] = useState(true)
  const [ambientOn, setAmbientOn] = useState(false)
  const [bgmOn, setBgmOn] = useState(false)
  const sounds = useSounds()

  const startGame = () => setScreen('game')

  return (
    <Screen>
      {screen==='start' && (
        <StartScreen onStart={()=>setScreen('setup')} playClick={sounds.playKeyClick} sfxOn={sfxOn} setSfxOn={setSfxOn} ambientOn={ambientOn} setAmbientOn={setAmbientOn} bgmOn={bgmOn} setBgmOn={setBgmOn} sounds={sounds} />
      )}
      {screen==='setup' && (
        <div className="w-full max-w-xl mx-auto space-y-8">
          <h1 className="heading-3d-strong font-arabic text-yellow-200 text-4xl md:text-5xl">Setup</h1>
          <div className="grid gap-6">
            <div className="grid gap-2">
              <span className="text-sm text-gray-400">Name</span>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="bg-black/40 border border-yellow-400/40 focus:border-yellow-400 outline-none rounded-md px-4 py-2 text-yellow-50" />
            </div>
            <div className="grid gap-3">
              <span className="text-sm text-gray-400">Mode</span>
              <div className="flex gap-6">
                <Radio checked={mode==='single'} onChange={()=>setMode('single')}>Single Player</Radio>
                <Radio checked={mode==='multi'} onChange={()=>setMode('multi')}>Multiplayer</Radio>
              </div>
            </div>
            {mode==='single' && (
              <div className="grid gap-3">
                <span className="text-sm text-gray-400">Play as</span>
                <div className="flex gap-6">
                  <Radio checked={piece==='X'} onChange={()=>setPiece('X')}>X (first)</Radio>
                  <Radio checked={piece==='O'} onChange={()=>setPiece('O')}>O (second)</Radio>
                </div>
              </div>
            )}
            {mode==='multi' && (
              <div className="grid gap-6">
                <div className="flex gap-6">
                  <Radio checked={hostMode==='host'} onChange={()=>setHostMode('host')}>Host</Radio>
                  <Radio checked={hostMode==='join'} onChange={()=>setHostMode('join')}>Join</Radio>
                </div>
                {hostMode==='host' ? (
                  <div className="grid gap-2">
                    <span className="text-sm text-gray-400">Room Code</span>
                    <div className="flex gap-3">
                      <input value={room} onChange={e=>setRoom(e.target.value.toUpperCase())} className="flex-1 bg-black/40 border border-yellow-400/40 focus:border-yellow-400 outline-none rounded-md px-4 py-2 tracking-[0.2em]" />
                      <button className="btn-3d-sm font-arabic" onClick={()=>{ if (sfxOn) sounds.playKeyClick(); setRoom(Math.random().toString(36).slice(2,7).toUpperCase()); }}>New</button>
                    </div>
                    <span className="text-xs text-gray-400">Open a second tab of this site and enter the same code to join.</span>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <span className="text-sm text-gray-400">Enter Room Code</span>
                    <input value={room} onChange={e=>setRoom(e.target.value.toUpperCase())} className="bg-black/40 border border-yellow-400/40 focus:border-yellow-400 outline-none rounded-md px-4 py-2 tracking-[0.2em]" />
                  </div>
                )}
              </div>
            )}
            <div className="pt-2">
              <button onClick={()=>{ if (sfxOn) sounds.playKeyClick(); if (ambientOn) sounds.startAmbientForest(); if (bgmOn) sounds.startBGM(); startGame(); }} className="btn-3d w-full font-arabic text-xl tracking-widest">Play</button>
            </div>
          </div>
        </div>
      )}
      {screen==='game' && (
        <Game
          you={name||'Player'}
          mode={mode}
          piece={piece}
          role={mode==='multi'?hostMode:'single'}
          room={room}
          onExit={()=>setScreen('start')}
          sounds={sounds}
          sfxOn={sfxOn}
        />
      )}
    </Screen>
  )
}

function Game({you, mode, piece, role, room, onExit, sounds, sfxOn}){
  const [board,setBoard] = useState(Array(9).fill(null))
  const [turn,setTurn] = useState('X')
  const [result,setResult] = useState(null)
  const [msg,setMsg] = useState('')
  const [opp,setOpp] = useState(mode==='single' ? 'Computer' : (role==='host'?'Waiting...':'Host'))
  const chanRef = useRef(null)
  const youAre = useMemo(()=>{
    if (mode==='single') return piece
    if (role==='host') return 'X'
    if (role==='join') return 'O'
    return 'X'
  },[mode, piece, role])

  const canPlay = (cell) => !result && board[cell]==null && turn===youAre

  useEffect(()=>{
    if (mode!=='multi') return
    const ch = new BroadcastChannel('ttt-'+room)
    chanRef.current = ch
    if (role==='host') {
      ch.postMessage({t:'HOST_CREATED', room, name: you})
    } else {
      ch.postMessage({t:'JOIN_REQ', room, name: you})
    }
    ch.onmessage = (e)=>{
      const m = e.data
      if (m.t==='JOIN_REQ' && role==='host'){
        setOpp(m.name||'Player')
        ch.postMessage({t:'JOIN_OK', name: you})
        setMsg('Opponent joined')
      } else if (m.t==='JOIN_OK' && role==='join'){
        setOpp(m.name||'Player')
        setMsg('Connected')
      } else if (m.t==='MOVE'){
        setBoard(b=>{
          if (b[m.i]) return b
          const nb=[...b]; nb[m.i]=m.p; return nb
        })
        setTurn(t=> t==='X'?'O':'X')
      } else if (m.t==='RESET'){
        setBoard(Array(9).fill(null)); setTurn('X'); setResult(null)
      }
    }
    return ()=> ch.close()
  },[mode, role, room, you])

  useEffect(()=>{
    const w = winnerOf(board)
    if (!w) return
    if (w==='draw') { setResult('draw'); setMsg('Draw'); if (sfxOn) sounds.playFail(); return }
    setResult(w)
    setMsg((w===youAre?'You win: ':'You lose: ')+w)
    if (sfxOn) sounds.playWin()
  },[board, sfxOn])

  useEffect(()=>{
    if (mode!=='single') return
    if (turn!== (youAre==='X'?'O':'X')) return
    if (result) return
    const i = aiMove(board, youAre==='X'?'O':'X', youAre)
    if (i>=0) setTimeout(()=>play(i), 260)
  },[board, turn, mode, youAre, result])

  const play = (i) => {
    if (!canPlay(i)) { setMsg('Invalid'); if (sfxOn) sounds.playFail(); return }
    setBoard(b=>{ const nb=[...b]; nb[i]=youAre; return nb })
    setTurn(t=> t==='X'?'O':'X')
    if (sfxOn) sounds.playTick()
    if (mode==='multi') chanRef.current?.postMessage({t:'MOVE', i, p: youAre})
  }

  const reset = () => {
    setBoard(Array(9).fill(null)); setTurn('X'); setResult(null); setMsg('')
    if (mode==='multi') chanRef.current?.postMessage({t:'RESET'})
  }

  const cells = board.map((v,i)=>{
    const neon = v==='X' ? 'mark-3d-x cell-mark' : v==='O' ? 'mark-3d-o cell-mark' : 'text-gray-400'
    return (
      <button key={i} onClick={()=>play(i)} disabled={!canPlay(i)}
        className={'aspect-square flex items-center justify-center text-5xl md:text-6xl font-extrabold border border-yellow-500/50 hover:bg-transparent disabled:opacity-60 transition ' + (board[i]? '':'hover:drop-shadow-[0_0_10px_#facc15]') }>
        <span className={neon}>{v||''}</span>
      </button>
    )
  })

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <NeonTitle>Tic Tac Toe</NeonTitle>
        <div className="flex gap-2">
          <PrimaryButton onClick={()=>{ if (sfxOn) sounds.playTick(); reset(); }}>Reset</PrimaryButton>
          <PrimaryButton onClick={()=>{ if (sfxOn) sounds.playTick(); sounds.stopAmbientForest(); sounds.stopBGM(); onExit(); }}>Exit</PrimaryButton>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-2">
          <div className="grid grid-cols-3 gap-2 p-3 bg-yellow-400/10 rounded-xl border border-yellow-500/40">
            {cells}
          </div>
          <div className="mt-4 text-center text-sm text-gray-300">{msg}</div>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-400/10">
            <div className="text-xs text-gray-400">You</div>
            <div className="text-lg font-semibold">{you} • {youAre}</div>
          </div>
          <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-400/10">
            <div className="text-xs text-gray-400">Opponent</div>
            <div className="text-lg font-semibold">{opp}</div>
          </div>
          <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-400/10">
            <div className="text-xs text-gray-400">Turn</div>
            <div className="text-lg font-semibold">{turn}</div>
          </div>
          {result && (
            <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-400/10 text-center">
              <div className="text-sm">{result==='draw'? 'Draw' : (result===youAre?'You win':'You lose')}</div>
            </div>
          )}
          {mode==='multi' && (
            <div className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-400/10">
              <div className="text-xs text-gray-400">Room</div>
              <div className="text-lg font-mono tracking-[0.2em]">{room}</div>
              <div className="text-xs text-gray-400 mt-2">Open in another tab and use the same room code.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
