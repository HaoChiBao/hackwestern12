import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

const useCrowdStream = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [heatmapGrid, setHeatmapGrid] = useState(null);
  
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize Socket
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnectionAttempts: 5
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to crowd stream backend');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from crowd stream backend');
      setIsConnected(false);
    });

    socket.on('heatmap_update', (data) => {
      const { grid, stats, timestamp } = data;
      
      // Transform backend stats to frontend format
      // Backend: { totalPeople, globalDensity, globalRiskLevel, maxDensity }
      // Frontend expects: { timestamp, totalPeople, globalDensity, globalRiskLevel, zones: [] }
      
      // We need to synthesize "zones" if the frontend relies on them for the list view
      // For now, we can create a single "Global Zone" or map the grid to zones if we had coordinates.
      // Let's create a dummy zone list to keep the UI happy.
      const zones = [
        {
          id: 'z1',
          name: 'Live Sector',
          peopleCount: stats.totalPeople,
          density: stats.globalDensity,
          riskLevel: stats.globalRiskLevel,
          // Add dummy values for others to prevent crashes
          packingScore: stats.globalDensity,
          avgSpeed: Math.max(0.1, 1.0 - stats.globalDensity),
          inflow: 0,
          outflow: 0,
          netFlow: 0
        }
      ];

      // Calculate max density for this frame
      let frameMax = 0;
      if (grid) {
          for (let i = 0; i < grid.length; i++) {
              if (grid[i] > frameMax) frameMax = grid[i];
          }
      }

      // Smooth max density to prevent flickering colors
      // We use a ref to store the previous max since we are inside a callback
      // But we can't easily access state here without deps.
      // Let's just pass the raw frameMax and let the hook state handle smoothing or just pass raw.
      // Actually, let's do simple smoothing here if we can.
      // We'll attach it to the stats object.
      
      const newGlobalStats = {
        timestamp: timestamp || Date.now(),
        totalPeople: stats.totalPeople,
        globalDensity: stats.globalDensity,
        globalRiskLevel: stats.globalRiskLevel,
        maxDensity: frameMax, // Pass raw max for this frame
        zones: zones
      };

      setCurrent(newGlobalStats);
      setHeatmapGrid(grid);

      // Update History
      setHistory(prev => {
        const newHist = [...prev, newGlobalStats];
        if (newHist.length > 60) return newHist.slice(newHist.length - 60);
        return newHist;
      });

      // Generate Alerts based on risk level
      if (stats.globalRiskLevel === 'critical' || stats.globalRiskLevel === 'high') {
        setAlerts(prev => {
          // Simple debounce: don't add if last alert was recent and same type
          const lastAlert = prev[0];
          if (lastAlert && lastAlert.severity === stats.globalRiskLevel && (Date.now() - lastAlert.timestamp < 5000)) {
            return prev;
          }
          
          return [{
            id: `${Date.now()}-alert`,
            timestamp: Date.now(),
            zoneId: 'z1',
            zoneName: 'Live Sector',
            severity: stats.globalRiskLevel,
            message: `High density detected: ${(stats.globalDensity * 100).toFixed(0)}% capacity.`
          }, ...prev].slice(0, 20);
        });
      }
    });

    // Video is now handled via MJPEG stream URL directly in the component

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const sendFrame = (image) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('process_frame', { image });
    }
  };

  // Function to clear/resolve an alert
  const clearAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  return { 
    current, 
    history, 
    alerts, 
    heatmapGrid, 
    isConnected, 
    sendFrame,
    clearAlert  // Export clearAlert function
  };
};

export { useCrowdStream };
