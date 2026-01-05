const http = require('http');
const { Server } = require('socket.io');

const httpServer = http.createServer();


httpServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/send-notification') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let data;
      try {
        // Guzzle sometimes sends x-www-form-urlencoded
        if (body.startsWith('{')) {
          data = JSON.parse(body);
        } else {
          const params = new URLSearchParams(body);
          data = {};
          params.forEach((value, key) => {
            data[key] = value;
          });
        }

        console.log('📨 Notificación recibida vía HTTP:', data);

        // 🔥 Asegurar que siempre exista el campo "type"
        data.type = data.type || 'info';

        // 🔥 Asegurar estructura estándar
        const normalized = {
          id: Date.now(),
          title: data.title || data.message || 'Notificación',
          message: data.message || data.title || '',
          type: data.type || 'info',
          order_id: data.order_id || null,
          module: data.module || null,
          user_id: data.user_id || null,
          created_at: new Date().toISOString(),
        };

        // 🔥 Enviar a sala de usuario si existe
        if (data.user_id) {
          io.to(`user_${data.user_id}`).emit('notification', normalized);
        } else {
          io.emit('notification', normalized);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));

      } catch (e) {
        console.error('❌ Error parseando notificación:', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });

  } else {
    res.writeHead(404);
    res.end();
  }
});



//mejar conexiones websocket
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Manejar conexiones de clientes
io.on('connection', (socket) => {
  console.log('🔗 Cliente conectado:', socket.id);

  // Unirse a una sala
  socket.on('subscribe', (room) => {
    socket.join(room);
    console.log(`📌 Cliente ${socket.id} unido a sala → ${room}`);
  });

  // Salir de una sala
  socket.on('unsubscribe', (room) => {
    socket.leave(room);
    console.log(`🚪 Cliente ${socket.id} SALIÓ de sala → ${room}`);
  });
  
  // Escuchar mensajes directamente
  socket.on('send-notification', (data) => {
    console.log('📨 Notificación recibida:', data);
    // Enviar a todos los clientes
    io.emit('notification', data);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Cliente desconectado:', socket.id, 'Razón:', reason);
  });
});

// Iniciar servidor en puerto 3000
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ Socket.io server running on port ${PORT}`);
});



/*/ ✅ AÑADE ESTO: Manejar solicitudes HTTP POST
httpServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/send-notification') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('📨 Notificación recibida via HTTP:', data);
        
        // Enviar a todos los clientes conectados
          if (data.user_id) {
            io.to(`user_${data.user_id}`).emit('notification', data);
          } else {
            io.emit('notification', data);
          }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});
*/