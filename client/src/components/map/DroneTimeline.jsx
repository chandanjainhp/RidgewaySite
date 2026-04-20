"use client";

import { useCallback } from "react";
import { useMapStore } from "@/store/mapStore";
import { NIGHT_START_HOUR } from "@/config/constants";
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
  const timelineWidthClass =
    timelinePosition <= 0 ? 'w-0' :
    timelinePosition <= 10 ? 'w-[10%]' :
    timelinePosition <= 20 ? 'w-[20%]' :
    timelinePosition <= 30 ? 'w-[30%]' :
    timelinePosition <= 40 ? 'w-[40%]' :
    timelinePosition <= 50 ? 'w-1/2' :
    timelinePosition <= 60 ? 'w-[60%]' :
    timelinePosition <= 70 ? 'w-[70%]' :
    timelinePosition <= 80 ? 'w-[80%]' :
    timelinePosition <= 90 ? 'w-[90%]' :
    'w-full';

  return (
        <div className="h-full w-full bg-surface-2 border-t border-border px-4 py-2 sm:px-6 md:py-3 z-40 flex flex-col justify-between">
      {/* Labels Row */}
      <div className="flex justify-between items-center w-full">
          <span className="font-mono text-agent-blue text-xs sm:text-sm font-bold w-16">{timeString}</span>
           <span className="font-display text-text-primary text-[10px] sm:text-xs uppercase tracking-[0.12em] text-center flex-1">Drone Patrol Replay</span>

         <div className="w-16 flex justify-end">
            {timelinePosition === 100 && (
              <span className="bg-severity-escalate text-white px-2 py-0.5 rounded-full font-mono text-[10px] uppercase animate-pulse">Live</span>
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
           aria-label="Drone patrol replay timeline"
           className="w-full appearance-none bg-transparent absolute inset-0 z-10 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-agent-blue [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:-mt-1.5
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-agent-blue [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
         />

         {/* Static Custom Render Track */}
         <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden absolute pointer-events-none border border-border/70">
          <div className={`h-full bg-agent-blue ${timelineWidthClass}`}></div>
         </div>
      </div>

      {/* Helper */}
      <div className="text-center font-mono text-[9px] sm:text-[10px] uppercase tracking-wide text-text-secondary">
        {formatNightLabel(new Date())} — scrub to replay patrol
      </div>
    </div>
  );
}
