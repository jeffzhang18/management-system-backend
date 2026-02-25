import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/ws', {
  transports: ['websocket'], // 强制走 websocket，避免 polling 干扰排查
  timeout: 5000,
});

function emitAck<T = any>(event: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    // 可选：加超时，避免 server 没回 ack 卡死
    const timer = setTimeout(() => reject(new Error(`${event} ack timeout`)), 5000);

    socket.emit(event, data, (ack: T) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

// socket.on('connect', () => {
//   console.log('[client] connect OK, id =', socket.id);
//   // 1) 发 ping 事件（期待 server return）
//   socket.emit('ping', { hello: 1 }, (ack: any) => {
//     console.log('[client] ping ack =', ack);
//     socket.emit('join', 'roomA', (ack2: any) => {
//       console.log('[client] join ack =', ack2);
//       console.log('[client] waiting for server push...');
//       socket.emit('leave', 'roomA', () => {
//         console.log('[client] leave OK');
//         socket.disconnect();
//       })
//     });
//   });
// });

socket.on('connect', async () => {
  console.log('[client] connect OK, id =', socket.id);

  const ack = await emitAck('ping', { hello: 1 });
  console.log('[client] ping ack =', ack);

  const ack2 = await emitAck('join', 'roomA');
  console.log('[client] join ack =', ack2);

  console.log('[client] waiting for server push...');


});

socket.on('connect_error', (err) => {
  console.log('[client] connect_error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[client] disconnected:', reason);
});

socket.on('broadcast', (msg) => {
  console.log('[client] broadcast event:', msg);
});

socket.on('notice', (msg) => {
  console.log('[client] notice event:', msg);
});