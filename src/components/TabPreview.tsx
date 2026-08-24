import React, { useEffect, useRef, useState, useCallback } from "react";
import { audioEngine } from "../lib/audioEngine";
import { Monitor, Maximize2, Tv, RefreshCcw, Radio } from "lucide-react";

interface TabPreviewProps {
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
}

export const TabPreview: React.FC<TabPreviewProps> = ({
  isConnected,
  isConnecting,
  onConnect,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [trackLabel, setTrackLabel] = useState<string>("");

  const updateVideoSource = useCallback((videoElement: HTMLVideoElement | null) => {
    if (!videoElement) return;
    const stream = audioEngine.getStream();
    if (stream && isConnected) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0 && videoTracks[0].readyState === "live") {
        if (videoElement.srcObject !== stream) {
          videoElement.srcObject = stream;
        }
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.play().catch((err) => {
          console.warn("Video playback failed:", err);
        });
      }
    }
  }, [isConnected]);

  // Ref callback to immediately bind stream when video mounts in DOM
  const setVideoRef = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element) {
      updateVideoSource(element);
    }
  }, [updateVideoSource]);

  useEffect(() => {
    const checkStream = () => {
      if (!isConnected) {
        setHasVideoTrack(false);
        setTrackLabel("");
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        return;
      }

      const stream = audioEngine.getStream();
      if (stream) {
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();

        if (videoTracks.length > 0 && videoTracks[0].readyState === "live") {
          setHasVideoTrack(true);
          setTrackLabel(videoTracks[0].label || "Captured Screen / Tab");
          if (videoRef.current) {
            updateVideoSource(videoRef.current);
          }
        } else {
          setHasVideoTrack(false);
          if (audioTracks.length > 0) {
            setTrackLabel(audioTracks[0].label || "Captured Audio Source");
          }
        }
      } else {
        setHasVideoTrack(false);
      }
    };

    checkStream();
    const interval = setInterval(checkStream, 400);
    return () => clearInterval(interval);
  }, [isConnected, updateVideoSource]);

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="h-full min-h-[240px] sm:min-h-[280px] lg:min-h-[300px] bg-zinc-950/30 rounded-2xl border border-zinc-800/50 p-4 sm:p-5 flex flex-col relative overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-zinc-400 tracking-widest uppercase">
            Source Preview
          </span>
        </div>

      </div>

      {/* Video / Placeholder Display Area */}
      <div className="flex-1 w-full min-h-[190px] relative rounded-xl bg-zinc-950/90 border border-zinc-800/80 overflow-hidden flex items-center justify-center">
        {isConnected && hasVideoTrack ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            {/* Overlay Gradient & Info */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/50 to-transparent p-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[11px] text-zinc-200 truncate max-w-[80%] font-medium">
                {trackLabel}
              </span>
              <button
                type="button"
                onClick={handleFullscreen}
                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                title="Fullscreen Preview"
                aria-label="Fullscreen Preview"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : isConnected ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
              <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-zinc-200 mb-1">
              Audio Source Active
            </p>
            <p className="text-[11px] text-zinc-500 max-w-[200px] truncate">
              {trackLabel || "Capturing system audio stream"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 border border-zinc-700/40 flex items-center justify-center mb-3 text-zinc-500">
              <Monitor className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-zinc-300 mb-1">
              No Active Preview
            </p>
            <p className="text-[10px] text-zinc-500 mb-3 max-w-[180px]">
              Capture a Chrome Tab or window to view its live feed here
            </p>
            <button
              type="button"
              onClick={onConnect}
              disabled={isConnecting}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {isConnecting ? (
                <>
                  <RefreshCcw className="w-3 h-3 animate-spin" /> Capturing...
                </>
              ) : (
                <>
                  <Tv className="w-3 h-3" /> Capture Tab
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer Meta */}
      {isConnected && (
        <div className="mt-2.5 flex items-center justify-between text-[10px] text-zinc-500 font-mono shrink-0">
          <span className="truncate max-w-[170px]">
            {trackLabel ? trackLabel : "Live Tab Stream"}
          </span>
          {/* <span className="text-cyan-400">Synchronized</span> */}
        </div>
      )}
    </div>
  );
};
