import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  
  @WebSocketGateway({
    namespace: '/ws',
    cors: { origin: '*' }, // 生产环境换成白名单
  })
  export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    handleConnection(client: Socket) {
        console.log('[WS] connected:', client.id);

        setTimeout(() => {
          client.emit('notice', { msg: 'hello from server', at: Date.now() });
        }, 1000);
    }
  
    handleDisconnect(client: Socket) {
      console.log('[WS] disconnected:', client.id);
    }
  
    @SubscribeMessage('ping')
    ping(@ConnectedSocket() client: Socket, @MessageBody() body: any) {
      return { message: 'pong', clientId: client.id, body };
    }
  
    @SubscribeMessage('join')
    joinRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
      client.join(room);
      return { ok: true, room };
    }

    @SubscribeMessage("leave")
    leaveRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
        client.leave(room)
        return { ok : true, left: room }
    }
  
    @SubscribeMessage("broadcastToRoom")
    broadcastToRoom(@MessageBody() data: any) {
      this.emitToRoom(data.room, 'notice' , data.msg)
      return { ok: true, data };
    }

    // 服务器推送：给某个 room
    emitToRoom(room: string, event: string, data: any) {
      this.server.to(room).emit(event, data);
    }
  
    // 服务器推送：给某个 client
    emitToClient(clientId: string, event: string, data: any) {
      this.server.to(clientId).emit(event, data);
    }

    // 服务器广播：给所有连接 client
    emitToBroadcast(event: string, data: any) {
      this.server.emit(event, data);
    }
  }