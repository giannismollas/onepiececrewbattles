let ioInstance = null;

export function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Join a specific lobby room
    socket.on('join_lobby', ({ publicCode }) => {
      if (publicCode) {
        const room = `lobby:${publicCode.toUpperCase().trim()}`;
        socket.join(room);
      }
    });

    // Leave room
    socket.on('leave_lobby', ({ publicCode }) => {
      if (publicCode) {
        const room = `lobby:${publicCode.toUpperCase().trim()}`;
        socket.leave(room);
      }
    });

    socket.on('disconnect', () => {
      // Disconnect handling
    });
  });
}

export function broadcastLobbyUpdate(publicCode, eventData = null) {
  if (ioInstance && publicCode) {
    const room = `lobby:${publicCode.toUpperCase().trim()}`;
    ioInstance.to(room).emit('lobby_updated', {
      publicCode: publicCode.toUpperCase().trim(),
      timestamp: new Date().toISOString(),
      eventData
    });
  }
}
