"use client";

import { useCallback } from "react";
import { useMapStore } from "@/store/mapStore";
import { NIGHT_START_HOUR, NIGHT_END_HOUR } from "@/config/constants";
import { formatNightLabel } from "@/lib/formatters";

export default function DroneTimeline() {
  const timelinePosition = useMapStore((state) => state.timelinePosition);
  const setTimelinePosition = useMapStore((state) => state.setTimelinePosition);
  const setTimelineTime = useMapStore((state) => state.setTimelineTime);

  // Time conversion: 0% -> 22:00, 100% -> 06:00 (8h timeline loop)
  const percentToTime = useCallback((percent) => {
    const totalMinutes = 8 * 60; // 8 hours * 60 mins
    const minutesToOffset = Math.floor((percent / 100) * totalMinutes);
    
    let hours = Math.floor(NIGHT_START_HOUR + (minutesToOffset / 60));
    const mins = minutesToOffset % 60;

    if (hours >= 24) hours = hours - 24;

    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `${hh}:${mm}`;
  }, []);

  const handleChange = (e) => {
    const percent = parseInt(e.target.value, 10);
    setTimelinePosition(percent);
    setTimelineTime(percentToTime(percent));
  };

  const timeString = percentToTime(timelinePosition);

  return (
    <div className="absolute bottom-0 w-full h-[80px] bg-surface-2 border-t border-border px-6 py-3 z-[400] flex flex-col justify-between shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
      {/* Labels Row */}
      <div className="flex justify-between items-center w-full">
         <span className="font-mono text-agent-blue text-sm font-bold w-[60px]">{timeString}</span>
         <span className="font-mono text-white text-xs uppercase tracking-widest text-center flex-1">Drone Patrol Replay</span>
         
         <div className="w-[60px] flex justify-end">
            {timelinePosition === 100 && (
               <span className="bg-severity-escalate text-white px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase animate-pulse">Live</span>
            )}
         </div>
      </div>

      {/* Scrub Track */}
      <div className="relative w-full h-8 flex items-center group">
         <input 
           type="range" 
           min="0" 
           max="100" 
           step="1"
           value={timelinePosition}
           onChange={handleChange}
           className="w-full appearance-none bg-transparent absolute inset-0 z-10 cursor-pointer 
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-agent-blue [&::-webkit-slider-thumb]:border-2 
            [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:mt-[-6px]"
         />
         
         {/* Static Custom Render Track */}
         <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden absolute pointer-events-none">
            <div className="h-full bg-agent-blue" style={{ width: `${timelinePosition}%` }}></div>
         </div>
      </div>

      {/* Helper */}
      <div className="text-center font-mono text-[10px] text-text-muted mt-[-2px]">
        {formatNightLabel(new Date())} — scrub to replay patrol
      </div>
    </div>
  );
}
