import React, { useEffect, useRef } from "react";
import { audioEngine } from "../lib/audioEngine";

export function Visualizer({ isClipping, peakReduction }: { isClipping: boolean; peakReduction: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataArray = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(256)));

  useEffect(() => {
    let frameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      frameId = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!audioEngine.analyser) {
        ctx.fillStyle = "#27272a"; // zinc-800
        ctx.fillRect(0, height / 2 - 1, width, 2);
        return;
      }

      const res = audioEngine.getVisualData(dataArray.current);
      // We don't propagate isClipping up to avoid huge re-renders if we don't have to, 
      // but we color the visualizer locally.

      const barWidth = (width / 64) * 2.5;
      let x = 0;

      for (let i = 0; i < 64; i++) {
        // Skip DC bin and start from low-frequency content so left bars represent bass.
        const idx = Math.min(dataArray.current.length - 1, 2 + i * 2);
        const val = dataArray.current[idx];
        const barHeight = (val / 255) * height;

        ctx.fillStyle = res.clipping ? "#ef4444" : "#22d3ee"; // red-500 or cyan-400
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        
        ctx.fillStyle = "#ffffff22";
        ctx.fillRect(x, height - barHeight - 2, barWidth, 2); // Peak cap

        x += barWidth + 2;
      }
    };

    draw();
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="w-full bg-zinc-950/50 rounded-xl border border-zinc-800/50 overflow-hidden relative">
      <canvas ref={canvasRef} width={500} height={100} className="w-full h-24 block opacity-80" />
      
      {/* Limiter overlay */}
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          {isClipping && (
            <span className="text-[10px] uppercase font-bold text-rose-500 animate-pulse tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
              Limiter Acive
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
