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
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5
    });

    const socket = socketRef.current;
    
    // Buffer for uploaded video analytics
    // Stored on the socket object for easy access in helper functions without refs
    const playbackBuffer = new Map();
    socket.playbackBuffer = playbackBuffer;

    socket.on('connect', () => {
      console.log('Connected to crowd stream backend');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from crowd stream backend');
      setIsConnected(false);
    });

    // Unified analytics handler
    const handleAnalytics = (data) => {
        // If buffered data (has t_ms), store it
        if (data.t_ms !== undefined) {
            playbackBuffer.set(data.t_ms, data);
            return;
        }
        
        // Otherwise treat as live data
        processAnalyticsData(data);
    };

    socket.on('analytics:update', handleAnalytics);
    
    // Legacy support
    socket.on('heatmap_update', handleAnalytics);

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const processAnalyticsData = (data) => {
      const { grid, stats, timestamp } = data;
      
      const zones = [
        {
          id: 'z1',
          name: 'Live Sector',
          peopleCount: stats.totalPeople || stats.total_people || 0,
          density: stats.globalDensity || stats.density || 0,
          riskLevel: stats.globalRiskLevel || stats.risk_level || 'low',
          packingScore: (stats.globalDensity || stats.density || 0),
          avgSpeed: Math.max(0.1, 1.0 - (stats.globalDensity || stats.density || 0)),
          inflow: 0, outflow: 0, netFlow: 0
        }
      ];

      let frameMax = stats.maxDensity || 0;
      if (grid && frameMax === 0) {
          for (let i = 0; i < grid.length; i++) {
              if (grid[i] > frameMax) frameMax = grid[i];
          }
      }

      const newGlobalStats = {
        timestamp: timestamp || Date.now(),
        totalPeople: stats.totalPeople || stats.total_people || 0,
        globalDensity: stats.globalDensity || stats.density || 0,
        globalRiskLevel: stats.globalRiskLevel || stats.risk_level || 'low',
        maxDensity: frameMax,
        zones: zones
      };

      setCurrent(newGlobalStats);
      setHeatmapGrid(grid);

      setHistory(prev => {
        const newHist = [...prev, newGlobalStats];
        if (newHist.length > 60) return newHist.slice(newHist.length - 60);
        return newHist;
      });

      const riskLevel = newGlobalStats.globalRiskLevel;
      if (riskLevel === 'critical' || riskLevel === 'high') {
        setAlerts(prev => {
          const lastAlert = prev[0];
          if (lastAlert && lastAlert.severity === riskLevel && (Date.now() - lastAlert.timestamp < 5000)) {
            return prev;
          }
          return [{
            id: `${Date.now()}-alert`,
            timestamp: Date.now(),
            zoneId: 'z1',
            zoneName: 'Live Sector',
            severity: riskLevel,
            message: `High density detected: ${(newGlobalStats.globalDensity * 100).toFixed(0)}% capacity.`
          }, ...prev].slice(0, 20);
        });
      }
  };

  const sendFrame = (image) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('process_frame', { image });
    }
  };
  
  const joinRoom = (roomName) => {
      if (socketRef.current && isConnected) {
          console.log('Joining room:', roomName);
          socketRef.current.emit('join', { room: roomName });
      }
  };

  const updatePlaybackTime = (timeMs) => {
      if (!socketRef.current || !socketRef.current.playbackBuffer) return;
      
      const buffer = socketRef.current.playbackBuffer;
      let bestTime = -1;
      let bestDiff = 500; // 500ms window

      for (const t of buffer.keys()) {
          const diff = Math.abs(t - timeMs);
          if (diff < bestDiff) {
              bestDiff = diff;
              bestTime = t;
          }
      }

      if (bestTime !== -1) {
          const data = buffer.get(bestTime);
          if (data) processAnalyticsData(data);
      }
  };

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
    joinRoom,
    updatePlaybackTime,
    clearAlert 
  };
};

export { useCrowdStream };
