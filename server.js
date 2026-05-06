import { createServer } from 'node:http';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3001;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  // Initialize Socket.io
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('join_campaign', (campaignId) => {
      socket.join(campaignId);
      console.log(`Player joined campaign ${campaignId}`);
      io.to(campaignId).emit('message', `A new player has joined the tavern!`);
    });

    socket.on('player_action', (data) => {
      // Broadcast player action to everyone in the campaign
      io.to(data.campaignId).emit('action_received', data);
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port} (with Socket.io)`);
    });
});
