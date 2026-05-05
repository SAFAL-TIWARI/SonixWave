import React, { useState, useEffect } from "react";
import { Headphones, Power, MonitorUp, Settings2, RefreshCcw, Activity, Disc, Layers, SlidersHorizontal, Waves } from "lucide-react";
import { audioEngine } from "./lib/audioEngine";
import { VerticalSlider, Knob, HorizontalSlider } from "./components/Controls";
import { Visualizer } from "./components/Visualizer";
import ReactiveBackground from "./components/ReactiveBackground";

const PRESETS = {
  Flat: [0, 0, 0, 0, 0],
  "Bass Boost": [6, 4, 0, -2, -2],
  "Vocal Boost": [-2, 0, 4, 6, 2],
  Gaming: [4, -2, 2, 6, 8],
  Movie: [6, 2, 0, 4, 6],
  "Night Mode": [-4, -2, 4, 2, -6],
};

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isBypassed, setIsBypassed] = useState(false);
  const [masterBoost, setMasterBoost] = useState(100);
  const [currentPreset, setCurrentPreset] = useState("Flat");
  const [eqGains, setEqGains] = useState<number[]>([0, 0, 0, 0, 0]);
  const [isClipping, setIsClipping] = useState(false);
  const [peakReduction, setPeakReduction] = useState(0);

  const [activeView, setActiveView] = useState<'master' | 'fx'>('master');

  // Background feature inputs (can edit in-code or use the UI toggle on top-right)
  // Mode precedence: image > video > color
  const [bgMode, setBgMode] = useState<'none' | 'image' | 'video' | 'color'>('none');
  const [bgImageUrl, setBgImageUrl] = useState<string>("");
  const [bgVideoUrl, setBgVideoUrl] = useState<string>("");
  const [bgColorMode] = useState<boolean>(false); // kept for backwards compatibility
  const bgPalette: string[] = ["#06b6d4", "#0ea5a9", "#7c3aed", "#ef4444"];
  const [showBgControls, setShowBgControls] = useState(false);
  
  type FxKey = "distortion" | "chorus" | "delay" | "reverb";
  const [fxState, setFxState] = useState<Record<FxKey, number>>({
    distortion: 0,
    chorus: 0,
    delay: 0,
    reverb: 0,
  });

  const FX_LIST: {id: FxKey, name: string, icon: any, desc: string}[] = [
    { id: "distortion", name: "Distortion", icon: Activity, desc: "Adds harmonics, saturates signal" },
    { id: "chorus", name: "Chorus", icon: Disc, desc: "Stereo widening and modulation" },
    { id: "delay", name: "Delay", icon: RefreshCcw, desc: "Echoes and tempo-based repetitions" },
    { id: "reverb", name: "Reverb", icon: Layers, desc: "Spatial acoustic room simulation" },
  ];

  const bands = ["60", "230", "910", "3.6k", "14k"];

  useEffect(() => {
    // Poll for clipping status to update UI indicator (Visualizer handles its own canvas)
    let interval: ReturnType<typeof setInterval>;
    if (isConnected && !isBypassed) {
      interval = setInterval(() => {
        const dummyArray = new Uint8Array(new ArrayBuffer(0)); // Not using the array here
        const res = audioEngine.getVisualData(dummyArray);
        setIsClipping(res.clipping);
        setPeakReduction(Math.abs(res.peakReduction));
      }, 100);
    } else {
      setIsClipping(false);
      setPeakReduction(0);
    }
    return () => clearInterval(interval);
  }, [isConnected, isBypassed]);

  const handleConnect = async () => {
    if (isConnected) {
      audioEngine.stop();
      setIsConnected(false);
    } else {
      await audioEngine.initialize(() => {
        setIsConnected(false);
      });
      // Apply current state
      audioEngine.setBypass(isBypassed);
      audioEngine.setMasterBoost(masterBoost);
      eqGains.forEach((gain, i) => audioEngine.setEqBand(i, gain));
      (Object.entries(fxState) as [FxKey, number][]).forEach(([key, val]) => {
        audioEngine.setFxAmount(key, val);
      });
      setIsConnected(true);
    }
  };

  const handleBypass = () => {
    const next = !isBypassed;
    setIsBypassed(next);
    audioEngine.setBypass(next);
  };

  const handleBoostChange = (val: number) => {
    setMasterBoost(val);
    audioEngine.setMasterBoost(val);
  };

  const handleEqChange = (index: number, val: number) => {
    const newGains = [...eqGains];
    newGains[index] = val;
    setEqGains(newGains);
    audioEngine.setEqBand(index, val);
    setCurrentPreset("Custom");
  };

  const handleFxChange = (fxId: FxKey, val: number) => {
    setFxState((prev) => ({ ...prev, [fxId]: val }));
    audioEngine.setFxAmount(fxId, val);
  };

  const applyPreset = (name: keyof typeof PRESETS) => {
    setCurrentPreset(name);
    const presetGains = PRESETS[name];
    setEqGains(presetGains);
    presetGains.forEach((gain, i) => audioEngine.setEqBand(i, gain));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex items-center justify-center p-6 font-sans selection:bg-cyan-500/30">
      <div className="w-full max-w-4xl bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex shadow-black/50 relative backdrop-blur-sm">
        <ReactiveBackground
          imageUrl={bgMode === 'image' ? bgImageUrl : undefined}
          videoUrl={bgMode === 'video' ? bgVideoUrl : undefined}
          colorMode={bgMode === 'color'}
          palette={bgPalette}
        />

        <div className="relative z-10 flex w-full">
        {/* Sidebar */}
        <div className="w-64 bg-zinc-950/55 border-r border-zinc-800/60 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
              <Headphones className="w-4 h-4 text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">SonixWave</h1>
          </div>

          <div className="space-y-6 flex-1">
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-2">Presets</h3>
              <div className="space-y-1">
                {Object.keys(PRESETS).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset as keyof typeof PRESETS)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      currentPreset === preset
                        ? "bg-zinc-800 text-cyan-400 font-medium"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-2">Controls</h3>
              <button
                onClick={handleBypass}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isBypassed ? "bg-rose-500/10 text-rose-500" : "text-zinc-400 hover:bg-zinc-800/50"
                }`}
              >
                <Power className="w-4 h-4" />
                {isBypassed ? "Bypass Active" : "Bypass Engine"}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800/60">
             <button
                onClick={handleConnect}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  isConnected 
                    ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" 
                    : "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                }`}
              >
                {isConnected ? (
                  <>
                    <RefreshCcw className="w-4 h-4" /> Disconnect
                  </>
                ) : (
                  <>
                    <MonitorUp className="w-4 h-4" /> Capture System Audio
                  </>
                )}
             </button>
             {!isConnected && (
               <p className="text-[10px] text-zinc-500 text-center mt-3 mx-1">
                 Browser prototype: Select a Chrome Tab or Entire Screen with "Share System Audio" checked.
               </p>
             )}
          </div>
        </div>

        {/* Main Interface */}
        <div className="flex-1 p-8 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-medium text-zinc-100 flex items-center gap-2">
                System Enhancer 
                {isConnected && !isBypassed && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
              </h2>
              <p className="text-sm text-zinc-500">Global dynamics and equalizer control</p>
            </div>
            <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveView(activeView === 'master' ? 'fx' : 'master')}
              className={`p-2 flex items-center gap-2 transition-colors rounded-full px-4 ${
                activeView === 'fx' 
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">{activeView === 'fx' ? 'Close FX' : 'Audio FX'}</span>
            </button>

            {/* Background toggle / controls (user requested a UI toggle) */}
            <div className="relative">
              <button
                onClick={() => setShowBgControls((s) => !s)}
                className="p-2 rounded-full bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800/70"
                title="Background Controls"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              {showBgControls && (
                <div className="absolute right-0 mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-lg p-3 shadow-lg z-50">
                  <div className="text-xs text-zinc-400 mb-2">Background Mode (only one active)</div>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setBgMode('image')} className={`px-2 py-1 rounded ${bgMode==='image' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Image</button>
                    <button onClick={() => setBgMode('video')} className={`px-2 py-1 rounded ${bgMode==='video' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Video</button>
                    <button onClick={() => setBgMode('color')} className={`px-2 py-1 rounded ${bgMode==='color' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Color</button>
                    <button onClick={() => setBgMode('none')} className={`px-2 py-1 rounded ${bgMode==='none' ? 'bg-rose-600/20 text-rose-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Off</button>
                  </div>

                  <div className="space-y-2">
                    {bgMode === 'image' && (
                      <input value={bgImageUrl} onChange={(e) => setBgImageUrl(e.target.value)} placeholder="Image URL" className="w-full px-2 py-1 rounded bg-zinc-800/40 text-sm text-zinc-200 border border-zinc-700" />
                    )}
                    {bgMode === 'video' && (
                      <input value={bgVideoUrl} onChange={(e) => setBgVideoUrl(e.target.value)} placeholder="Video URL" className="w-full px-2 py-1 rounded bg-zinc-800/40 text-sm text-zinc-200 border border-zinc-700" />
                    )}
                    {bgMode === 'color' && (
                      <div className="text-xs text-zinc-400">Color reactive mode uses palette and audio beats.</div>
                    )}
                  </div>

                  <div className="mt-3 text-right">
                    <button onClick={() => setShowBgControls(false)} className="px-3 py-1 rounded bg-zinc-800/40 text-sm text-zinc-300">Close</button>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>

          <Visualizer isClipping={isClipping} peakReduction={peakReduction} />

          <div className="flex-1 grid grid-cols-12 gap-8 mt-8 relative">
            
            {activeView === 'master' ? (
              <>
                {/* Boost Knob */}
                <div className="col-span-5 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 flex flex-col items-center justify-center p-6 relative">
                  <div className="absolute top-4 left-4 text-xs font-semibold text-zinc-500 tracking-widest uppercase">
                    Master Boost
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isClipping ? "text-rose-400" : "text-zinc-500"}`}>
                      LIM: {peakReduction.toFixed(1)}dB
                    </div>
                  </div>
                  
                  <div className="mt-4 filter drop-shadow-lg">
                    <Knob 
                      value={masterBoost} 
                      min={0} 
                      max={1000} 
                      onChange={handleBoostChange} 
                    />
                  </div>
                  <div className="mt-8 flex w-full justify-between px-4 text-xs font-medium text-zinc-500 font-mono">
                    <span>0%</span>
                    <span>100%</span>
                    <span className="text-cyan-400/70">1000%</span>
                  </div>
                </div>

                {/* Equalizer */}
                <div className="col-span-7 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 p-6 flex flex-col relative">
                  <div className="absolute top-4 left-4 text-xs font-semibold text-zinc-500 tracking-widest uppercase">
                    Equalizer
                  </div>
                  
                  <div className="flex-1 flex justify-around items-end pt-8">
                    {eqGains.map((gain, i) => (
                      <VerticalSlider
                        key={i}
                        label={bands[i]}
                        value={gain}
                        min={-12}
                        max={12}
                        step={1}
                        zeroCentered
                        onChange={(val) => handleEqChange(i, val)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-12 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 p-6 flex flex-col relative overflow-y-auto max-h-[340px]">
                <div className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-6 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-cyan-400" /> Effects Rack
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  {FX_LIST.map(fx => {
                    const Icon = fx.icon;
                    return (
                      <div key={fx.id} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                              <Icon className={`w-4 h-4 ${fxState[fx.id as keyof typeof fxState] > 0 ? 'text-cyan-400' : 'text-zinc-500'}`} />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-zinc-200">{fx.name}</div>
                              <div className="text-[10px] text-zinc-500">{fx.desc}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="pl-1">
                          <HorizontalSlider 
                            label="Mix" 
                            value={fxState[fx.id]} 
                            min={0} 
                            max={100} 
                            onChange={(val) => handleFxChange(fx.id, val)} 
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

