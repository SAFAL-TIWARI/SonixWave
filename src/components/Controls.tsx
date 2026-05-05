import { LucideIcon } from "lucide-react";
import React from "react";
import { cn } from "../lib/utils";

interface VerticalSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  zeroCentered?: boolean;
}

export const VerticalSlider: React.FC<VerticalSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  zeroCentered = false,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const zeroPercentage = zeroCentered ? ((0 - min) / (max - min)) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-mono text-zinc-400">{value > 0 && zeroCentered ? "+" : ""}{value}{zeroCentered ? "dB" : "%"}</span>
      <div className="relative h-48 w-8 py-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-48 h-8 -rotate-90 origin-[24px_24px] cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-sm"
          style={{ transform: "rotate(360deg) translate(-50%, -50%)", top: "50%", left: "50%" }}
        />
        <div className="pointer-events-none absolute inset-x-2 inset-y-0 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-inner overflow-hidden">
          {/* Fill Bar */}
          {zeroCentered ? (
            <>
              {/* Positive Fill */}
              {value > 0 && (
                <div
                  className="absolute bottom-1/2 left-0 right-0 bg-cyan-400/50 rounded-t-full transition-all duration-75"
                  style={{ height: `${percentage - zeroPercentage}%` }}
                />
              )}
              {/* Negative Fill */}
              {value < 0 && (
                <div
                  className="absolute top-1/2 left-0 right-0 bg-rose-500/50 rounded-b-full transition-all duration-75"
                  style={{ height: `${zeroPercentage - percentage}%` }}
                />
              )}
              {/* Center Line */}
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-zinc-500" />
            </>
          ) : (
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600 to-cyan-400 transition-all duration-75"
              style={{ height: `${percentage}%` }}
            />
          )}
        </div>
      </div>
      <span className="text-xs font-medium text-zinc-500">{label}</span>
    </div>
  );
}

// Master Knob
export function Knob({
  value,
  min,
  max,
  onChange,
  size = 120,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  size?: number;
}) {
  const rotation = ((value - min) / (max - min)) * 270 - 135; // -135 to +135 deg

  return (
    <div
      className="relative flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-700/50 shadow-2xl"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-2 border border-zinc-700/30 rounded-full" />
      <div
        className="w-full h-full rounded-full flex items-start justify-center pt-2 transition-transform duration-75 ease-out"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="w-1.5 h-4 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold font-mono tracking-tighter text-zinc-100">{value}</span>
        <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Boost</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="absolute inset-0 opacity-0 cursor-ns-resize"
      />
      {/* Tick Marks (Optional) */}
    </div>
  );
}

export function HorizontalSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}) {
  const percentage = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center text-xs text-zinc-500 font-mono">
        <span className="uppercase tracking-widest font-semibold">{label}</span>
        <span className="text-cyan-400">{Math.round(percentage)}%</span>
      </div>
      <div className="relative h-6 w-full flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(34,211,238,0.5)] z-10"
        />
        <div className="pointer-events-none absolute inset-x-0 h-2 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-inner overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
