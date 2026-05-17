import React, { useEffect, useRef } from "react";
import { audioEngine } from "../lib/audioEngine";

type SpectrumStyle = "bars" | "wave" | "rainbow" | "pulse";

export function Visualizer({ isClipping, peakReduction, spectrum = "bars" }: { isClipping: boolean; peakReduction: number; spectrum?: SpectrumStyle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const freqData = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(1024)));
  const timeData = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(1024)));

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

      const analyser = audioEngine.analyser;
      // ensure arrays are sized to analyser.fftSize/2 for freq
      const freqLen = analyser.frequencyBinCount;
      if (freqData.current.length !== freqLen) freqData.current = new Uint8Array(freqLen);
      if (timeData.current.length !== analyser.fftSize) timeData.current = new Uint8Array(analyser.fftSize);

      if (spectrum === "wave") {
        analyser.getByteTimeDomainData(timeData.current);

        ctx.lineWidth = 2;
        ctx.strokeStyle = isClipping ? "#ef4444" : "#22d3ee";
        ctx.beginPath();
        const step = Math.max(1, Math.floor(timeData.current.length / width));
        for (let x = 0; x < width; x++) {
          const idx = Math.floor((x / width) * timeData.current.length);
          const v = timeData.current[idx] / 128.0 - 1.0; // -1..1
          const y = height / 2 + v * (height / 2 - 4);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        return;
      }

      if (spectrum === "pulse") {
        analyser.getByteFrequencyData(freqData.current);

        const bars = 65;
        const centerY = height / 2;
        const barGap = 6;
        const barWidth = Math.max(4, Math.floor((width - (bars - 1) * barGap) / bars));
        const maxHalfHeight = Math.max(18, Math.floor(height * .36));

        ctx.save();
        ctx.shadowColor = "rgba(255,255,255,0.9)";
        ctx.shadowBlur = 1;
        ctx.fillStyle = "#ffffff";

        let x = 0;
        for (let i = 0; i < bars; i++) {
          const baseIdx = Math.floor((i / bars) * freqData.current.length);
          const sampleA = freqData.current[Math.min(freqData.current.length - 1, baseIdx)];
          const sampleB = freqData.current[Math.min(freqData.current.length - 1, baseIdx + 1)];
          const sampleC = freqData.current[Math.min(freqData.current.length - 1, baseIdx + 2)];
          const energy = (sampleA * 0.5 + sampleB * 0.3 + sampleC * 0.2) / 255;

          const shaped = Math.pow(energy, 1.35);
          const halfHeight = Math.max(1, Math.round(shaped * maxHalfHeight));
          const roundedWidth = Math.max(4, Math.min(8, barWidth));

          // alternate a few taller spikes so the rhythm resembles the reference image
          const spikeBoost = i % 9 === 0 ? 1.7 : i % 5 === 0 ? 1.25 : 1;
          const finalHalfHeight = Math.min(maxHalfHeight, Math.round(halfHeight * spikeBoost));

          ctx.fillRect(x, centerY - finalHalfHeight, roundedWidth, finalHalfHeight * 2);
          x += barWidth + barGap;
        }

        ctx.restore();

        // subtle baseline glow
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, centerY - 1, width, 2);
        ctx.restore();

        return;
      }

      analyser.getByteFrequencyData(freqData.current);
      const resClipping = isClipping;

      if (spectrum === "bars") {
        const bars = 100;
        const barWidth = (width / bars) * 2.5;
        let x = 0;
        for (let i = 0; i < bars; i++) {
          const idx = Math.min(freqData.current.length - 1, 2 + i * Math.floor(freqData.current.length / bars));
          const val = freqData.current[idx];
          const barHeight = (val / 255) * height;

          ctx.fillStyle = resClipping ? "#ef4444" : "#22d3ee";
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          ctx.fillStyle = "#ffffff22";
          ctx.fillRect(x, height - barHeight - 2, barWidth, 2);
          x += barWidth + 2;
        }

        return;
      }

      if (spectrum === "rainbow") {
        // Rainbow segmented column visualizer to match provided image
        const bars = 120;
        const barGap = 2;
        const barWidth = Math.max(3, Math.floor((width - (bars - 1) * barGap) / bars));
        const segmentHeight = 6;
        const segmentGap = 2;
        const totalSegments = Math.floor(height / (segmentHeight + segmentGap));

        let x = 0;
        for (let i = 0; i < bars; i++) {
          const idx = Math.min(freqData.current.length - 1, Math.floor((i / bars) * freqData.current.length));
          const val = freqData.current[idx];
          const segmentsToDraw = Math.round((val / 255) * totalSegments);

          // Color across the horizontal axis (purple -> blue -> cyan -> green -> yellow -> orange -> red)
          const hue = 280 - Math.floor((i / bars) * 300); // approx range 280->-20 => wraps to rainbow

          // draw stacked segments from bottom up
          for (let s = 0; s < segmentsToDraw; s++) {
            const segY = height - (s + 1) * (segmentHeight + segmentGap) + segmentGap / 2;

            // Slightly vary lightness so upper segments appear brighter
            const light = 35 + Math.round((s / Math.max(1, totalSegments - 1)) * 40);
            const color = `hsl(${(hue + 360) % 360},85%,${light}%)`;

            ctx.fillStyle = color;
            ctx.beginPath();
            // rounded rect approximated by slightly inset fill to create separation effect
            ctx.rect(x, segY, barWidth, segmentHeight);
            ctx.fill();
          }

          // small glowing top for the highest segment
          if (segmentsToDraw > 0) {
            const topY = height - segmentsToDraw * (segmentHeight + segmentGap) + segmentGap / 2;
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            ctx.fillRect(x, topY, barWidth, 2);
          }

          x += barWidth + barGap;
        }

        // subtle overlay glow
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    };

    draw();
    return () => cancelAnimationFrame(frameId);
  }, [spectrum, isClipping]);

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
