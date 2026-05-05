import React, { useEffect, useRef, useState } from "react";
import { audioEngine } from "../lib/audioEngine";

type Props = {
  imageUrl?: string;
  videoUrl?: string;
  colorMode?: boolean;
  palette?: string[];
  maxScale?: number; // max extra scale (e.g. 0.08 => up to 8% zoom)
};

export const ReactiveBackground: React.FC<Props> = ({
  imageUrl,
  videoUrl,
  colorMode = false,
  palette = ["#06b6d4", "#0ea5a9", "#7c3aed", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#ec4899"],
  maxScale = 0.08,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [scale, setScale] = useState(1);
  const [color, setColor] = useState<string>(palette[0]);

  // Determine active mode: image > video > color
  const mode = imageUrl ? "image" : videoUrl ? "video" : colorMode ? "color" : "none";

  useEffect(() => {
    let raf = 0;
    let prev = 0;
    let env = 0;
    let floor = 0;
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const startLoopWith = (analyser: AnalyserNode) => {
      const data = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        if (stopped) return;
        analyser.getByteFrequencyData(data);

        // Bass-only detector: focus on ~35-140 Hz so zoom follows kick/sub energy.
        const binToHz = analyser.context.sampleRate / analyser.fftSize;
        const bassLowHz = 40;
        const bassHighHz = 140;
        const startBin = Math.max(0, Math.floor(bassLowHz / binToHz));
        const endBin = Math.min(data.length - 1, Math.ceil(bassHighHz / binToHz));

        let weightedSum = 0;
        let weightTotal = 0;
        for (let i = startBin; i <= endBin; i++) {
          const v = data[i] / 255; // 0..1
          // Slightly emphasize the lower part of the bass band.
          const freq = i * binToHz;
          const weight = Math.max(0.35, 1 - (freq - bassLowHz) / Math.max(1, bassHighHz - bassLowHz));
          weightedSum += v * weight;
          weightTotal += weight;
        }

        const bassNorm = weightTotal > 0 ? weightedSum / weightTotal : 0;

        // Adaptive floor + gate so non-bass content does not keep zoom pumping.
        floor = floor * 0.995 + bassNorm * 0.005;
        const gated = Math.max(0, bassNorm - floor * 1.08 - 0.025);

        // Envelope (faster attack, slower release) for musical but stable motion.
        env = Math.max(gated, env * 0.88);

        // Smooth (simple leaky integrator)
        const smooth = prev * 0.82 + env * 0.18;
        prev = smooth;

        // Map to scale
        const nextScale = 1 + smooth * maxScale;
        setScale(nextScale);

        // If color mode, pick palette index based on energy
        if (mode === "color") {
          const idx = Math.floor(smooth * (palette.length - 1));
          setColor(palette[idx] || palette[0]);
        }

        raf = requestAnimationFrame(loop);
      };

      raf = requestAnimationFrame(loop);
    };

    // If analyser exists, start immediately, otherwise poll until available
    if (audioEngine.analyser) {
      startLoopWith(audioEngine.analyser);
    } else {
      poll = setInterval(() => {
        if (audioEngine.analyser) {
          clearInterval(poll!);
          startLoopWith(audioEngine.analyser as AnalyserNode);
        }
      }, 200);
    }

    return () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, palette, maxScale]);

  // If video mode, ensure video plays
  useEffect(() => {
    if (mode === "video" && videoRef.current) {
      const v = videoRef.current;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      // best-effort play
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    }
  }, [mode, videoUrl]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-2xl"
      style={{ willChange: "transform" }}
    >
      {/* Always-visible base background so the layer is obvious even before mode selection */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(6,182,212,0.14),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(59,130,246,0.1),transparent_42%)]" />

      {/* overlay for scaling effect */}
      <div
        className="absolute inset-0"
        style={{
          transform: `scale(${scale})`,
          transition: "transform 100ms linear",
        }}
      >
        {mode === "image" && imageUrl && (
          <img
            src={imageUrl}
            alt="background"
            className="w-full h-full object-cover block"
            style={{ filter: "brightness(0.35) contrast(1.05)", transformOrigin: "center" }}
          />
        )}

        {mode === "video" && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover block"
            style={{ filter: "brightness(0.35) contrast(1.05)", transformOrigin: "center" }}
            playsInline
            muted
            loop
            autoPlay
          />
        )}

        {mode === "color" && (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(120deg, ${color}, rgba(0,0,0,0.08))`,
              mixBlendMode: "overlay",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ReactiveBackground;
