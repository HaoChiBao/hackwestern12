import { useState, useEffect, useRef } from 'react';

// Types (implicitly defined via JSDoc for this JS project)
/**
 * @typedef {'low' | 'medium' | 'high' | 'critical'} RiskLevel
 * 
 * @typedef {Object} ZoneStats
 * @property {string} id
 * @property {string} name
 * @property {number} peopleCount
 * @property {number} density - 0-1
 * @property {number} packingScore - 0-1
 * @property {number} avgSpeed - 0-1
 * @property {number} inflow
 * @property {number} outflow
 * @property {number} netFlow
 * @property {RiskLevel} riskLevel
 * 
 * @typedef {Object} GlobalStats
 * @property {number} timestamp
 * @property {number} totalPeople
 * @property {number} globalDensity
 * @property {RiskLevel} globalRiskLevel
 * @property {ZoneStats[]} zones
 * 
 * @typedef {Object} CrowdAlert
 * @property {string} id
 * @property {number} timestamp
 * @property {string | null} zoneId
 * @property {string | null} zoneName
 * @property {RiskLevel} severity
 * @property {string} message
 */

const ZONES_CONFIG = [
  { id: 'z1', name: 'Stage Front' },
  { id: 'z2', name: 'Main Corridor' },
  { id: 'z3', name: 'Exit A' },
  { id: 'z4', name: 'Exit B' },
];

const generateZoneStats = (zoneConfig, prevStats) => {
  // Simulate random fluctuations
  const countChange = Math.floor(Math.random() * 11) - 5; // -5 to +5
  let newCount = (prevStats?.peopleCount || 50) + countChange;
  newCount = Math.max(0, Math.min(300, newCount)); // Clamp 0-300

  // Derived metrics
  const density = newCount / 300; // Normalize to max capacity
  const packingScore = density * (0.8 + Math.random() * 0.4); // Correlated with density
  
  // Speed inversely related to density
  const baseSpeed = 1.0 - density; 
  const avgSpeed = Math.max(0.1, Math.min(1.0, baseSpeed + (Math.random() * 0.2 - 0.1)));

  const inflow = Math.max(0, Math.floor(Math.random() * 5));
  const outflow = Math.max(0, Math.floor(Math.random() * 5));

  // Risk Logic
  let riskLevel = 'low';
  if (density >= 0.85 || (density >= 0.7 && avgSpeed < 0.2)) riskLevel = 'critical';
  else if (density >= 0.65) riskLevel = 'high';
  else if (density >= 0.4) riskLevel = 'medium';

  return {
    id: zoneConfig.id,
    name: zoneConfig.name,
    peopleCount: newCount,
    density,
    packingScore,
    avgSpeed,
    inflow,
    outflow,
    netFlow: inflow - outflow,
    riskLevel,
  };
};

export const useFakeCrowdStream = (intervalMs = 1000) => {
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  
  // Keep track of previous state for smooth transitions
  const prevStatsRef = useRef({});

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      
      // Generate Zone Stats
      const zones = ZONES_CONFIG.map(config => {
        const stats = generateZoneStats(config, prevStatsRef.current[config.id]);
        prevStatsRef.current[config.id] = stats;
        return stats;
      });

      // Aggregate Global Stats
      const totalPeople = zones.reduce((sum, z) => sum + z.peopleCount, 0);
      const globalDensity = zones.reduce((sum, z) => sum + z.density, 0) / zones.length;
      
      // Global Risk is max of zone risks
      const riskPriority = { low: 0, medium: 1, high: 2, critical: 3 };
      let globalRiskLevel = 'low';
      let maxRiskVal = 0;
      
      zones.forEach(z => {
        const val = riskPriority[z.riskLevel];
        if (val > maxRiskVal) {
          maxRiskVal = val;
          globalRiskLevel = z.riskLevel;
        }
      });

      const newGlobalStats = {
        timestamp: now,
        totalPeople,
        globalDensity,
        globalRiskLevel,
        zones,
      };

      setCurrent(newGlobalStats);

      // Update History (keep last 60)
      setHistory(prev => {
        const newHist = [...prev, newGlobalStats];
        if (newHist.length > 60) return newHist.slice(newHist.length - 60);
        return newHist;
      });

      // Generate Alerts
      const newAlerts = [];
      zones.forEach(z => {
        // Simple threshold alert logic
        if (z.riskLevel === 'critical' && (!prevStatsRef.current[z.id]?.riskLevel || prevStatsRef.current[z.id].riskLevel !== 'critical')) {
          newAlerts.push({
            id: `${now}-${z.id}-crit`,
            timestamp: now,
            zoneId: z.id,
            zoneName: z.name,
            severity: 'critical',
            message: `CRITICAL density detected in ${z.name}. Evacuation protocols recommended.`
          });
        } else if (z.riskLevel === 'high' && prevStatsRef.current[z.id]?.riskLevel === 'medium') {
          newAlerts.push({
            id: `${now}-${z.id}-high`,
            timestamp: now,
            zoneId: z.id,
            zoneName: z.name,
            severity: 'high',
            message: `High congestion building in ${z.name}.`
          });
        }
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev].slice(0, 20)); // Keep last 20
      }
    };

    const timer = setInterval(tick, intervalMs);
    tick(); // Initial tick

    return () => clearInterval(timer);
  }, [intervalMs]);

  return { current, history, alerts };
};
