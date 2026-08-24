import React, { useState, useEffect } from "react";
import { Headphones, Power, MonitorUp, Settings2, RefreshCcw, Activity, Disc, Layers, SlidersHorizontal, Waves, VolumeX, Puzzle, Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { audioEngine } from "./lib/audioEngine";
import { VerticalSlider, Knob, HorizontalSlider } from "./components/Controls";
import { Visualizer } from "./components/Visualizer";
import ReactiveBackground from "./components/ReactiveBackground";
import { TabPreview } from "./components/TabPreview";

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBypassed, setIsBypassed] = useState(true);
  const [masterBoost, setMasterBoost] = useState(100);
  const [manualBoostInput, setManualBoostInput] = useState("100");
  const [currentPreset, setCurrentPreset] = useState("Flat");
  const [eqGains, setEqGains] = useState<number[]>([0, 0, 0, 0, 0]);
  const [isClipping, setIsClipping] = useState(false);
  const [peakReduction, setPeakReduction] = useState(0);
  const [muteCapturedSourcePlayback, setMuteCapturedSourcePlayback] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const [activeView, setActiveView] = useState<'master' | 'fx'>('master');

  // Background feature inputs (can edit in-code or use the UI toggle on top-right)
  // Mode precedence: image > video > color
  const [bgMode, setBgMode] = useState<'none' | 'image' | 'video' | 'color'>('none');
  const [bgImageUrl, setBgImageUrl] = useState<string>("");
  const [bgVideoUrl, setBgVideoUrl] = useState<string>("");
  const [bgColorMode] = useState<boolean>(false); // kept for backwards compatibility
  const bgPalette: string[] = ["#06b6d4", "#0ea5a9", "#7c3aed", "#ef4444"];
  const [showBgControls, setShowBgControls] = useState(false);
  const [spectrumStyle, setSpectrumStyle] = useState<'bars' | 'wave' | 'rainbow' | 'pulse'>('bars');

  const BG_STORAGE_KEYS = {
    mode: "sonixwave:bgMode",
    imageUrl: "sonixwave:bgImageUrl",
    videoUrl: "sonixwave:bgVideoUrl",
  } as const;
  
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
    try {
      const savedMode = localStorage.getItem(BG_STORAGE_KEYS.mode) as 'none' | 'image' | 'video' | 'color' | null;
      const savedImageUrl = localStorage.getItem(BG_STORAGE_KEYS.imageUrl) ?? "";
      const savedVideoUrl = localStorage.getItem(BG_STORAGE_KEYS.videoUrl) ?? "";

      if (savedMode) {
        setBgMode(savedMode);
      } else if (savedImageUrl) {
        setBgMode("image");
      } else if (savedVideoUrl) {
        setBgMode("video");
      }

      setBgImageUrl(savedImageUrl);
      setBgVideoUrl(savedVideoUrl);
    } catch {
      // Ignore storage errors in private/restricted browser modes.
    }
  }, []);

  const saveBackgroundSetting = (kind: 'image' | 'video') => {
    try {
      const nextMode = kind;
      localStorage.setItem(BG_STORAGE_KEYS.mode, nextMode);
      if (kind === 'image') {
        localStorage.setItem(BG_STORAGE_KEYS.imageUrl, bgImageUrl.trim());
      } else {
        localStorage.setItem(BG_STORAGE_KEYS.videoUrl, bgVideoUrl.trim());
      }

      setBgMode(nextMode);
    } catch {
      // Ignore storage errors in private/restricted browser modes.
    }
  };

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
      setIsConnecting(true);
      const startTime = performance.now();
      console.log("[SonixWave] Starting audio capture...");
      
      audioEngine.setSourcePlaybackMuted(muteCapturedSourcePlayback);
      
      try {
        await audioEngine.initialize(() => {
          setIsConnected(false);
        });
        
        const initTime = performance.now() - startTime;
        console.log(`[SonixWave] Audio capture initialized in ${initTime.toFixed(2)}ms`);
        
        // Apply current state
        audioEngine.setBypass(isBypassed);
        audioEngine.setMasterBoost(masterBoost);
        eqGains.forEach((gain, i) => audioEngine.setEqBand(i, gain));
        (Object.entries(fxState) as [FxKey, number][]).forEach(([key, val]) => {
          audioEngine.setFxAmount(key, val);
        });
        setIsConnected(true);
      } catch (err) {
        console.error("[SonixWave] Audio capture failed:", err);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleBypass = () => {
    const next = !isBypassed;
    setIsBypassed(next);
    audioEngine.setBypass(next);
  };

  const handleBoostChange = (val: number) => {
    setMasterBoost(val);
    setManualBoostInput(String(val));
    audioEngine.setMasterBoost(val);
  };

  const applyManualBoostInput = () => {
    const parsedValue = Number(manualBoostInput);

    if (Number.isNaN(parsedValue)) {
      setManualBoostInput(String(masterBoost));
      return;
    }

    const clampedValue = Math.max(0, Math.min(1000, parsedValue));
    setMasterBoost(clampedValue);
    setManualBoostInput(String(clampedValue));
    audioEngine.setMasterBoost(clampedValue);
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

  const handleMuteCapturedSourceToggle = async () => {
    const next = !muteCapturedSourcePlayback;
    setMuteCapturedSourcePlayback(next);
    audioEngine.setSourcePlaybackMuted(next);
  };

  const applyPreset = (name: keyof typeof PRESETS) => {
    setCurrentPreset(name);
    const presetGains = PRESETS[name];
    setEqGains(presetGains);
    presetGains.forEach((gain, i) => audioEngine.setEqBand(i, gain));
  };

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50">
            <Headphones className="w-4 h-4 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">SonixWave</h1>
        </div>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsDesktopSidebarCollapsed(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
            title="Minimize sidebar"
            aria-label="Minimize sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-1">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-2">Presets</h3>
          <div className="space-y-1">
            {Object.keys(PRESETS).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  applyPreset(preset as keyof typeof PRESETS);
                  if (isMobile) setIsSidebarOpen(false);
                }}
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

          <button
            onClick={handleMuteCapturedSourceToggle}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              muteCapturedSourcePlayback
                ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                : "text-zinc-400 hover:bg-zinc-800/50"
            }`}
            title="Best effort browser support: mutes local playback from a captured tab or window when the browser supports it"
          >
            <VolumeX className="w-4 h-4" />
            {muteCapturedSourcePlayback ? "Captured Source Muted" : "Mute Captured Source"}
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-800/60 mt-auto">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
            isConnecting
              ? "bg-zinc-700 text-zinc-300 border border-zinc-600 cursor-wait opacity-75"
              : isConnected 
              ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700" 
              : "bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          }`}
        >
          {isConnecting ? (
            <>
              <RefreshCcw className="w-4 h-4 animate-spin" /> Initializing...
            </>
          ) : isConnected ? (
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
          <p className="text-[10px] text-zinc-500 text-center mt-3 mx-1 leading-relaxed">
            Browser prototype: Select a Chrome Tab or Entire Screen with "Share System Audio" checked.
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 flex flex-col items-center justify-start md:justify-center p-3 sm:p-5 md:p-6 py-6 font-sans selection:bg-cyan-500/30 overflow-y-auto">
      {/* Mobile Off-canvas Drawer & Backdrop */}
      <div className="md:hidden">
        <div
          className={`fixed inset-0 backdrop-blur-sm z-40 transition-opacity duration-300 ${
            isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-zinc-950/98 border-r border-zinc-800 p-6 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {renderSidebarContent(true)}
        </aside>
      </div>

      <div className="w-full max-w-6xl bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex shadow-black/50 relative backdrop-blur-sm my-auto">
        <ReactiveBackground
          imageUrl={bgMode === 'image' ? bgImageUrl : undefined}
          videoUrl={bgMode === 'video' ? bgVideoUrl : undefined}
          colorMode={bgMode === 'color'}
          palette={bgPalette}
        />

        <div className="relative z-10 flex w-full">
          {/* Desktop Docked Sidebar (Collapsible) */}
          {!isDesktopSidebarCollapsed && (
            <aside className="hidden md:flex md:w-64 bg-zinc-950/55 border-r border-zinc-800/60 p-6 flex-col shrink-0">
              {renderSidebarContent(false)}
            </aside>
          )}

          {/* Main Interface */}
          <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col min-w-0">
            <div className="flex justify-between items-center mb-6 md:mb-8 gap-3">
              <div className="flex items-center gap-3">
                {/* Mobile Sidebar Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:text-cyan-400 hover:bg-zinc-800 transition-colors flex items-center justify-center shadow-sm"
                  aria-label="Open sidebar"
                  title="Open sidebar"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Desktop Expand Sidebar Button (only when minimized) */}
                {isDesktopSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsDesktopSidebarCollapsed(false)}
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-300 hover:text-cyan-400 hover:bg-zinc-800 transition-colors shadow-sm text-xs font-medium"
                    title="Expand sidebar"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                    <span>Sidebar</span>
                  </button>
                )}

                <div>
                  <h2 className="text-xl sm:text-2xl font-medium text-zinc-100 flex items-center gap-2">
                    System Enhancer 
                    {isConnected && !isBypassed && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-500">Global dynamics and equalizer control</p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Extension Link */}
                <a
                  href="https://drive.google.com/file/d/1V08dRXY-ugE7d3g95NGBY8ewGPEKnNWj/view?usp=drive_link"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800/70 hover:text-cyan-400 transition-colors flex items-center justify-center"
                  title="Get Chrome Extension"
                  aria-label="Get Chrome Extension"
                >
                  <Puzzle className="w-4 h-4" />
                </a>

                {/* Background toggle / controls */}
                <div className="relative">
                  <button
                    onClick={() => setShowBgControls((s) => !s)}
                    className="p-2 rounded-full bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800/70"
                    title="Background Controls"
                    aria-label="Background Controls"
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
                          <div className="relative">
                            <input
                              value={bgImageUrl}
                              onChange={(e) => setBgImageUrl(e.target.value)}
                              placeholder="Image URL"
                              className="w-full rounded bg-zinc-800/40 text-sm text-zinc-200 border border-zinc-700 px-2 py-1 pr-16"
                            />
                            <button
                              type="button"
                              onClick={() => saveBackgroundSetting('image')}
                              className="absolute right-1 top-1 rounded-md bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/25"
                            >
                              Save
                            </button>
                          </div>
                        )}
                        {bgMode === 'video' && (
                          <div className="relative">
                            <input
                              value={bgVideoUrl}
                              onChange={(e) => setBgVideoUrl(e.target.value)}
                              placeholder="Video or social link"
                              className="w-full rounded bg-zinc-800/40 text-sm text-zinc-200 border border-zinc-700 px-2 py-1 pr-16"
                            />
                            <button
                              type="button"
                              onClick={() => saveBackgroundSetting('video')}
                              className="absolute right-1 top-1 rounded-md bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/25"
                            >
                              Save
                            </button>
                          </div>
                        )}
                        {bgMode === 'color' && (
                          <div className="text-xs text-zinc-400">Color reactive mode uses palette and audio beats.</div>
                        )}
                        {bgMode === 'video' && (
                          <div className="text-xs text-zinc-400">Paste a direct media URL or a supported social post link such as YouTube, Instagram, or Vimeo.</div>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="text-xs text-zinc-400 mb-2">Spectrum Style</div>
                        <div className="flex gap-2 mb-2 text-xs">
                          <button onClick={() => setSpectrumStyle('bars')} className={`px-2 py-1 rounded ${spectrumStyle==='bars' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Bars</button>
                          <button onClick={() => setSpectrumStyle('rainbow')} className={`px-2 py-1 rounded ${spectrumStyle==='rainbow' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Rainbow</button>
                          
                          <button onClick={() => setSpectrumStyle('pulse')} className={`px-2 py-1 rounded ${spectrumStyle==='pulse' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Pulse</button>
                          <button onClick={() => setSpectrumStyle('wave')} className={`px-2 py-1 rounded ${spectrumStyle==='wave' ? 'bg-cyan-600/30 text-cyan-300' : 'bg-zinc-800/40 text-zinc-300'}`}>Waveform</button>
                        </div>
                        <div className="text-[10px] text-zinc-500">Choose the visual spectrum style used by the visualizer.</div>
                      </div>

                      <div className="mt-3 text-right">
                        <button onClick={() => setShowBgControls(false)} className="px-3 py-1 rounded bg-zinc-800/40 text-sm text-zinc-300">Close</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Visualizer isClipping={isClipping} peakReduction={peakReduction} spectrum={spectrumStyle} />

            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-8 mt-6 md:mt-8 relative w-full">
              {activeView === 'master' ? (
                <>
                  {/* Boost Knob */}
                  <div className={`w-full ${isDesktopSidebarCollapsed ? "lg:col-span-4" : "lg:col-span-5"} bg-zinc-950/30 rounded-2xl border border-zinc-800/50 flex flex-col items-center justify-center p-6 relative`}>
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
                      <span>1000%</span>
                    </div>
                    <div className="mt-4 w-full px-4">
                      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                        Manual Volume
                      </label>
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          step={1}
                          value={manualBoostInput}
                          onChange={(e) => setManualBoostInput(e.target.value)}
                          onBlur={applyManualBoostInput}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              applyManualBoostInput();
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                          placeholder="Enter volume 0 - 1000"
                        />
                        <button
                          type="button"
                          onClick={applyManualBoostInput}
                          className="shrink-0 rounded-lg bg-cyan-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300 transition-colors hover:bg-cyan-500/25"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Equalizer */}
                  <div className={`w-full ${isDesktopSidebarCollapsed ? "lg:col-span-4" : "lg:col-span-7"} bg-zinc-950/30 rounded-2xl border border-zinc-800/50 p-4 sm:p-6 flex flex-col relative min-h-[300px]`}>
                    <div className="absolute top-4 left-4 text-xs font-semibold text-zinc-500 tracking-widest uppercase">
                      Equalizer
                    </div>
                    
                    <div className="flex-1 flex justify-between sm:justify-around items-end pt-8 pb-1">
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

                  {/* Desktop: Live Tab Preview Section (Appears beside Equalizer on desktop ONLY when sidebar is minimized) */}
                  {isDesktopSidebarCollapsed && (
                    <div className="hidden lg:flex flex-col lg:col-span-4 h-full">
                      <TabPreview
                        isConnected={isConnected}
                        isConnecting={isConnecting}
                        onConnect={handleConnect}
                      />
                    </div>
                  )}

                  {/* Mobile & Tablet: Live Tab Preview Section (Positioned below Equalizer) */}
                  <div className="block lg:hidden w-full">
                    <TabPreview
                      isConnected={isConnected}
                      isConnecting={isConnecting}
                      onConnect={handleConnect}
                    />
                  </div>
                </>
              ) : (
                <div className="lg:col-span-12 bg-zinc-950/30 rounded-2xl border border-zinc-800/50 p-4 flex flex-col relative overflow-y-auto max-h-[340px]">
                  <div className="text-xs font-semibold text-zinc-500 tracking-widest uppercase mb-6 flex items-center gap-2">
                    <Waves className="w-4 h-4 text-cyan-400" /> Effects Rack
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {FX_LIST.map(fx => {
                      const Icon = fx.icon;
                      return (
                        <div key={fx.id} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3 flex flex-col gap-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
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

