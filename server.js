const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 班级列表：把这里改成你学校的真实班级
const CLASSES = [
  { id: 'class1', name: '一年级2班' },
  { id: 'class2', name: '一年级5班' },
  { id: 'class3', name: '二年级3班' },
  { id: 'class4', name: '二年级8班' }
];

const screens = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/classes', (req, res) => res.json(CLASSES));
app.get('/', (req, res) => res.redirect('/teacher.html'));

io.on('connection', (socket) => {
  socket.on('join', ({ role, classId }) => {
    if (!classId) return;
    for (const room of socket.rooms) {
      if (room !== socket.id) socket.leave(room);
    }
    socket.data.role = role;
    socket.data.classId = classId;
    socket.join(classId);

    if (role === 'screen') {
      if (!screens.has(classId)) screens.set(classId, new Set());
      screens.get(classId).add(socket.id);
      broadcastPresence(classId);
    } else {
      socket.emit('presence', {
        classId,
        online: (screens.get(classId)?.size || 0) > 0
      });
    }
  });

  socket.on('message:send', (payload, ack) => {
    const { classId, text, urgent } = payload || {};
    if (!classId || !text) return ack?.({ ok: false, error: '参数不完整' });

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      classId,
      text: String(text).slice(0, 200),
      urgent: !!urgent,
      ts: Date.now()
    };
    io.to(classId).emit('message:new', msg);
    ack?.({ ok: true, msg });
  });

  socket.on('disconnect', () => {
    const { role, classId } = socket.data || {};
    if (role === 'screen' && classId && screens.has(classId)) {
      screens.get(classId).delete(socket.id);
      if (screens.get(classId).size === 0) screens.delete(classId);
      broadcastPresence(classId);
    }
  });
});

function broadcastPresence(classId) {
  io.to(classId).emit('presence', {
    classId,
    online: (screens.get(classId)?.size || 0) > 0
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`服务已启动：http://localhost:${PORT}`);
});