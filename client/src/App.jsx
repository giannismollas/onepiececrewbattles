import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import Home from './components/Home';
import JoinLobby from './components/JoinLobby';
import ShipSetup from './components/ShipSetup';
import BattleArena from './components/BattleArena';
import AdminSpectator from './components/AdminSpectator';
import BattleHistory from './components/BattleHistory';
import BattleReplay from './components/BattleReplay';
import RulesModal from './components/RulesModal';
import LobbyShareModal from './components/LobbyShareModal';
import { soundEffects } from './services/soundEffects';

// Global Socket.IO instance
const socket = io();

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showRules, setShowRules] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [lobbyState, setLobbyState] = useState(null);
  const [loadingLobby, setLoadingLobby] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);

  // Client-side URL routing helper
  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  // Listen to browser forward/backward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Parse path
  const parseRoute = (path) => {
    if (path.startsWith('/lobby/')) {
      const parts = path.split('/');
      return { route: 'JOIN', publicCode: parts[2]?.toUpperCase() };
    }
    if (path.startsWith('/battle/')) {
      const parts = path.split('/');
      const publicCode = parts[2]?.toUpperCase();
      if (parts[3] === 'admin') {
        return { route: 'ADMIN', publicCode, adminToken: parts[4] };
      }
      if (parts[3] === 'p') {
        return { route: 'BATTLE', publicCode, playerToken: parts[4] };
      }
    }
    if (path === '/history') {
      return { route: 'HISTORY' };
    }
    if (path.startsWith('/replay/')) {
      const parts = path.split('/');
      return { route: 'REPLAY', publicCode: parts[2]?.toUpperCase() };
    }
    return { route: 'HOME' };
  };

  const parsed = parseRoute(currentPath);

  // Fetch lobby state for active battle/admin route
  const fetchActiveLobbyState = useCallback(async () => {
    if (parsed.route !== 'BATTLE' && parsed.route !== 'ADMIN') return;

    const token = parsed.playerToken || parsed.adminToken;
    try {
      const res = await fetch(`/api/lobby/${parsed.publicCode}?token=${token}`);
      if (!res.ok) {
        throw new Error('Lobby not found or authorization failed.');
      }
      const data = await res.json();
      setLobbyState(data);
      setLobbyError(null);
    } catch (err) {
      setLobbyError(err.message);
    } finally {
      setLoadingLobby(false);
    }
  }, [parsed.route, parsed.publicCode, parsed.playerToken, parsed.adminToken]);

  // Load state and setup WebSocket listener
  useEffect(() => {
    if (parsed.route === 'BATTLE' || parsed.route === 'ADMIN') {
      setLoadingLobby(true);
      fetchActiveLobbyState();

      // Join socket room
      socket.emit('join_lobby', { publicCode: parsed.publicCode });

      const handleUpdate = (payload) => {
        if (payload?.publicCode === parsed.publicCode) {
          fetchActiveLobbyState();
          // If turn changed, play turn chime
          if (payload?.eventData?.type === 'ATTACK_RESOLVED' || payload?.eventData?.type === 'REPAIR_RESOLVED') {
            setTimeout(() => {
              soundEffects.playTurnChime();
            }, 500);
          }
        }
      };

      socket.on('lobby_updated', handleUpdate);

      return () => {
        socket.emit('leave_lobby', { publicCode: parsed.publicCode });
        socket.off('lobby_updated', handleUpdate);
      };
    } else {
      setLobbyState(null);
    }
  }, [parsed.route, parsed.publicCode, fetchActiveLobbyState]);

  // Render view
  let content = null;

  if (parsed.route === 'HOME') {
    content = <Home navigate={navigate} onOpenRules={() => setShowRules(true)} />;
  } else if (parsed.route === 'JOIN') {
    content = <JoinLobby publicCode={parsed.publicCode} navigate={navigate} />;
  } else if (parsed.route === 'HISTORY') {
    content = <BattleHistory navigate={navigate} />;
  } else if (parsed.route === 'REPLAY') {
    content = <BattleReplay publicCode={parsed.publicCode} navigate={navigate} />;
  } else if (parsed.route === 'ADMIN') {
    if (loadingLobby) {
      content = (
        <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
          <h2 className="font-pirate text-gold" style={{ fontSize: '2rem' }}>Opening Command Bridge...</h2>
        </div>
      );
    } else if (lobbyError || !lobbyState) {
      content = (
        <div className="container" style={{ maxWidth: '600px', marginTop: '60px' }}>
          <div className="gold-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <h2 className="font-pirate text-crimson" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>ADMIN ACCESS DENIED</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{lobbyError || 'Invalid admin token or lobby does not exist.'}</p>
            <button className="btn btn-gold" onClick={() => navigate('/')}>Return to Home</button>
          </div>
        </div>
      );
    } else {
      content = (
        <AdminSpectator 
          lobbyState={lobbyState} 
          adminToken={parsed.adminToken} 
          onRefresh={fetchActiveLobbyState}
          navigate={navigate}
        />
      );
    }
  } else if (parsed.route === 'BATTLE') {
    if (loadingLobby) {
      content = (
        <div className="container" style={{ textAlign: 'center', padding: '100px 0' }}>
          <h2 className="font-pirate text-gold" style={{ fontSize: '2rem' }}>Boarding Flagship...</h2>
        </div>
      );
    } else if (lobbyError || !lobbyState) {
      content = (
        <div className="container" style={{ maxWidth: '600px', marginTop: '60px' }}>
          <div className="gold-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <h2 className="font-pirate text-crimson" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>BOARDING FAILED</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>{lobbyError || 'Invalid player token or lobby expired.'}</p>
            <button className="btn btn-gold" onClick={() => navigate('/')}>Return to Home</button>
          </div>
        </div>
      );
    } else {
      // Determine if Setup or Active Battle
      const isBattleActive = (lobbyState.lobby.status === 'ACTIVE' || lobbyState.lobby.status === 'COMPLETED' || lobbyState.lobby.status === 'SURRENDERED' || lobbyState.lobby.status === 'PAUSED');

      if (isBattleActive) {
        content = (
          <BattleArena 
            lobbyState={lobbyState} 
            token={parsed.playerToken} 
            onOpenShare={() => setShowShareModal(true)}
            navigate={navigate}
          />
        );
      } else {
        content = (
          <ShipSetup 
            lobbyState={lobbyState} 
            token={parsed.playerToken} 
            onOpenShare={() => setShowShareModal(true)}
            onOpenRules={() => setShowRules(true)}
          />
        );
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header 
        currentRoute={currentPath} 
        navigate={navigate} 
        onOpenRules={() => setShowRules(true)} 
      />

      <main style={{ flex: 1 }}>
        {content}
      </main>

      {/* Rules Modal */}
      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

      {/* Share Links Modal */}
      {lobbyState && (
        <LobbyShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          lobbyInfo={{
            publicCode: lobbyState.lobby.publicCode,
            playerToken: parsed.playerToken,
            adminToken: null // admin token kept private
          }}
        />
      )}
    </div>
  );
}
