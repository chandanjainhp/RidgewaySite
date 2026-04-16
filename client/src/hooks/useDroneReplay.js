import { useEffect, useState } from "react";
import { getDroneRouteGeometry, getDroneStateAtTime, simulateFollowUpMission } from "@/lib/api";
import { useMapStore } from "@/store/mapStore"; // Target future store dependency

export function useDroneReplay(patrolId) {
  const [isLoading, setIsLoading] = useState(false);
  const setDroneRoute = useMapStore ? useMapStore((state) => state.setDroneRoute) : () => {};
  const setDronePosition = useMapStore ? useMapStore((state) => state.setDronePosition) : () => {};
  
  const timelineTime = useMapStore ? useMapStore((state) => state.timelineTime) : null;
  const currentPosition = useMapStore ? useMapStore((state) => state.droneCurrentPosition) : null;

  // Mount logic to get global drone path geometry
  useEffect(() => {
    let active = true;
    if (patrolId && setDroneRoute) {
      setIsLoading(true);
      getDroneRouteGeometry(patrolId).then((data) => {
        if (active) {
          setDroneRoute(data);
          setIsLoading(false);
        }
      }).catch(() => {
        if(active) setIsLoading(false);
      });
    }
    return () => { active = false; };
  }, [patrolId, setDroneRoute]);

  // Debounced timeline positioning logic
  useEffect(() => {
    if (!patrolId || !timelineTime || !setDronePosition) return;
    
    const handler = setTimeout(() => {
      getDroneStateAtTime(patrolId, timelineTime).then(data => {
        setDronePosition(data);
      }).catch(err => console.error("Drone Time Error", err));
    }, 200);

    return () => clearTimeout(handler);
  }, [patrolId, timelineTime, setDronePosition]);

  return {
    isLoading,
    currentPosition,
    timelineTime,
    observationsToDate: currentPosition?.observationsToDate || []
  };
}

export function useFollowUpSimulation() {
  const followUpLocations = useMapStore ? useMapStore((state) => state.followUpLocations) : [];
  const [simulation, setSimulation] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    let active = true;
    if (followUpLocations && followUpLocations.length > 0) {
      setIsSimulating(true);
      simulateFollowUpMission(followUpLocations).then(data => {
        if (active) {
          setSimulation(data);
          setIsSimulating(false);
        }
      }).catch(() => {
        if (active) setIsSimulating(false);
      });
    } else {
      setSimulation(null);
    }

    return () => { active = false; };
  }, [followUpLocations]);

  return { simulation, isSimulating };
}
