// ws-server.cjs (PRODUCCIÓN HARDENED)
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();

// ================================
// ✅ CONFIG PRODUCCIÓN
// ================================
const PORT = Number(process.env.WS_PORT || 3000);

const ALLOWED_ORIGINS = (process.env.WS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LARAVEL_API_BASE = (process.env.LARAVEL_API_BASE || '').replace(/\/$/, '');

const LARAVEL_ME_ENDPOINT =
  process.env.LARAVEL_ME_ENDPOINT || `${LARAVEL_API_BASE}/auth/me`;

const LARAVEL_CONV_ENDPOINT =
  process.env.LARAVEL_CONV_ENDPOINT || `${LARAVEL_API_BASE}/chat/conversations`;

const NOTIFY_KEY = process.env.WS_NOTIFY_KEY || '';

// ======= AUTH HARDENING =======
const AUTH_TIMEOUT_MS = Number(process.env.WS_AUTH_TIMEOUT_MS || 15000); // antes 7000
const AUTH_RETRIES = Number(process.env.WS_AUTH_RETRIES || 8);           // reintentos
const AUTH_RETRY_BASE_DELAY_MS = Number(process.env.WS_AUTH_RETRY_BASE_DELAY_MS || 500);
const AUTH_CACHE_TTL_MS = Number(process.env.WS_AUTH_CACHE_TTL_MS || 60_000); // 60s cache por token

// Cache participantes conv
const CONV_CACHE_TTL_MS = Number(process.env.CONV_CACHE_TTL_MS || 30_000);

// Límites básicos
app.use(express.json({ limit: '1mb' }));

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('CORS not allowed'), false);
    },
    credentials: true,
  })
);

// ================================
// 🔔 ENDPOINT HTTP PARA NOTIFICACIONES
// ================================
app.post('/send-notification', (req, res) => {
  try {
    if (NOTIFY_KEY) {
      const key = req.header('x-ws-key');
      if (!key || key !== NOTIFY_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    const data = req.body || {};
    const normalized = {
      id: Date.now(),
      title: data.title || data.message || 'Notificación',
      message: data.message || data.title || '',
      type: data.type || 'info',
      module: data.module || null,
      user_id: data.user_id || null,
      created_at: new Date().toISOString(),
    };

    if (normalized.user_id) {
      io.to(userRoom(normalized.user_id)).emit('notification', normalized);
    } else {
      io.emit('notification', normalized);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error enviando notificación:', err);
    res.status(400).json({ error: 'Invalid notification payload' });
  }
});

app.get('/', (_req, res) => {
  res.send('Chat + Notifications WebSocket server running');
});

const server = http.createServer(app);

// ================================
// 🔥 SOCKET.IO SETUP
// ================================
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
});

// ================================
// Estado en memoria
// ================================
// userId -> { sockets:Set, user:{id,name,email,avatar_url,status} }
const onlineUsers = new Map();

// convId -> { userIds:Set<number>, expiresAt:number }
const convParticipantsCache = new Map();

// token -> { user, expiresAt }
const tokenUserCache = new Map();

// ================================
// Helpers
// ================================
function userRoom(userId) {
  return `user:${userId}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms) {
  // +/- 20%
  const delta = ms * 0.2;
  return Math.max(0, Math.floor(ms + (Math.random() * 2 - 1) * delta));
}

function broadcastOnlineUsers() {
  const users = [...onlineUsers.values()].map((u) => u.user);
  io.emit('users:online', { users });
}

function upsertOnlineUser(user) {
  let entry = onlineUsers.get(user.id);

  if (!entry) {
    entry = {
      sockets: new Set(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email || null,
        avatar_url: user.avatar_url || null,
        status: user.status || 'online',
      },
    };
    onlineUsers.set(user.id, entry);
  } else {
    entry.user = {
      ...entry.user,
      name: user.name ?? entry.user.name,
      email: user.email ?? entry.user.email,
      avatar_url: user.avatar_url ?? entry.user.avatar_url,
      status: user.status ?? entry.user.status,
    };
  }

  return entry;
}

// ================================
// ✅ AUTH: Laravel with retry + cache
// ================================
async function fetchUserFromLaravel(token) {
  if (!LARAVEL_ME_ENDPOINT) {
    throw new Error('LARAVEL_ME_ENDPOINT no configurado');
  }

  const resp = await axios.get(LARAVEL_ME_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: AUTH_TIMEOUT_MS,
  });

  const u = resp.data?.data ?? resp.data;
  if (!u?.id) throw new Error('Usuario inválido en endpoint auth');

  return {
    id: Number(u.id),
    name: `${u.name ?? ''} ${u.surname ?? ''}`.trim() || u.name || 'Usuario',
    email: u.email || null,
    avatar_url: u.avatar_url ?? (u.avatar ? `${u.avatar}` : null),
    status: 'online',
  };
}

function getCachedUser(token) {
  const entry = tokenUserCache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tokenUserCache.delete(token);
    return null;
  }
  return entry.user;
}

function setCachedUser(token, user) {
  tokenUserCache.set(token, {
    user,
    expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
  });
}

async function fetchUserFromLaravelWithRetry(token) {
  // ✅ cache primero
  const cached = getCachedUser(token);
  if (cached) return cached;

  let lastErr = null;

  for (let attempt = 1; attempt <= AUTH_RETRIES; attempt++) {
    try {
      const user = await fetchUserFromLaravel(token);
      setCachedUser(token, user);
      return user;
    } catch (err) {
      lastErr = err;

      const msg =
        err?.response?.status
          ? `HTTP ${err.response.status}`
          : err?.code || err?.message || 'unknown';

      // Si es 401/403, NO tiene sentido reintentar mil veces (token inválido)
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        throw new Error(`Unauthorized token (${msg})`);
      }

      // Backoff exponencial con jitter
      const delay = jitter(AUTH_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));

      console.warn(
        `⚠️ WS auth retry ${attempt}/${AUTH_RETRIES} (${msg}). Reintentando en ${delay}ms...`
      );

      await sleep(delay);
    }
  }

  throw new Error(
    `Auth failed after ${AUTH_RETRIES} retries: ${lastErr?.message || 'unknown'}`
  );
}

// ================================
// Participantes conversación (ya lo tenías bien)
/// ================================
async function getConversationParticipants(convId, token) {
  const now = Date.now();
  const cached = convParticipantsCache.get(convId);
  if (cached && cached.expiresAt > now) return cached.userIds;

  const url = `${LARAVEL_CONV_ENDPOINT}/${convId}`;

  const resp = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: AUTH_TIMEOUT_MS,
  });

  const conv = resp.data?.data ?? resp.data;
  const parts = conv?.participants || [];
  const ids = new Set(parts.map((p) => Number(p.id)).filter(Boolean));

  convParticipantsCache.set(convId, {
    userIds: ids,
    expiresAt: now + CONV_CACHE_TTL_MS,
  });

  return ids;
}

// ================================
// ✅ MIDDLEWARE WS: autenticar handshake
// ================================
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query?.token;

    if (!token || typeof token !== 'string' || token.length < 10) {
      return next(new Error('Unauthorized: missing token'));
    }

    // ✅ ahora con retry + cache
    const user = await fetchUserFromLaravelWithRetry(token);

    socket.data.token = token;
    socket.data.user = user;
    socket.data.userId = user.id;

    return next();
  } catch (err) {
    console.error('❌ WS auth error:', err?.message || err);
    return next(new Error('Unauthorized'));
  }
});

// ================================
// ✅ CONEXIÓN
// ================================
io.on('connection', (socket) => {
  const user = socket.data.user;
  const userId = socket.data.userId;

  console.log('🟢 WS conectado:', socket.id, 'user:', userId);

  socket.join(userRoom(userId));

  const entry = upsertOnlineUser(user);
  entry.sockets.add(socket.id);

  broadcastOnlineUsers();

  socket.on('register', (payload) => {
    try {
      const safeStatus = payload?.status;
      if (safeStatus) {
        const e = onlineUsers.get(userId);
        if (e) e.user.status = safeStatus;
        broadcastOnlineUsers();
      }
    } catch (err) {
      console.error('❌ Error en register:', err);
    }
  });

  // 💬 chat:send
  socket.on('chat:send', async (payload) => {
    try {
      const token = socket.data.token;
      if (!token) return;

      const { message, conversation_id } = payload || {};
      if (!message || !conversation_id) return;

      const convId = Number(conversation_id);
      const senderId = userId;

      const participants = await getConversationParticipants(convId, token);
      if (!participants.has(senderId)) return;

      participants.forEach((uid) => {
        io.to(userRoom(uid)).emit('chat:message', {
          conversation_id: convId,
          message: {
            ...message,
            sender_id: senderId,
          },
        });
      });
    } catch (err) {
      console.error('❌ Error en chat:send:', err?.message || err);
    }
  });

  // ✏️ typing
  socket.on('chat:typing', async (payload) => {
    try {
      const token = socket.data.token;
      if (!token) return;

      const { conversation_id, is_typing } = payload || {};
      if (!conversation_id) return;

      const convId = Number(conversation_id);
      const fromUserId = userId;

      const participants = await getConversationParticipants(convId, token);
      if (!participants.has(fromUserId)) return;

      participants.forEach((uid) => {
        if (uid === fromUserId) return;
        io.to(userRoom(uid)).emit('chat:typing', {
          conversation_id: convId,
          from_user_id: fromUserId,
          is_typing: !!is_typing,
        });
      });
    } catch (err) {
      console.error('❌ Error en chat:typing:', err?.message || err);
    }
  });

  // 👁 read
  socket.on('chat:read', async (payload) => {
    try {
      const token = socket.data.token;
      if (!token) return;

      const { conversation_id } = payload || {};
      if (!conversation_id) return;

      const convId = Number(conversation_id);
      const readerId = userId;

      const participants = await getConversationParticipants(convId, token);
      if (!participants.has(readerId)) return;

      participants.forEach((uid) => {
        if (uid === readerId) return;
        io.to(userRoom(uid)).emit('chat:read', {
          conversation_id: convId,
          user_id: readerId,
        });
      });
    } catch (err) {
      console.error('❌ Error en chat:read:', err?.message || err);
    }
  });

  socket.on('disconnect', () => {
    const entry = onlineUsers.get(userId);
    if (entry) {
      entry.sockets.delete(socket.id);
      if (entry.sockets.size === 0) {
        onlineUsers.delete(userId);
      }
    }
    broadcastOnlineUsers();
    console.log('🔴 WS desconectado:', socket.id, 'user:', userId);
  });
});

// ================================
// 🚀 INICIAR SERVIDOR
// ================================
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server (Chat + Notificaciones) en puerto ${PORT}`);
  console.log('✅ Allowed origins:', ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '(dev: any)');
  console.log('✅ Auth endpoint:', LARAVEL_ME_ENDPOINT);
  console.log('✅ Auth timeout(ms):', AUTH_TIMEOUT_MS);
  console.log('✅ Auth retries:', AUTH_RETRIES);
});
