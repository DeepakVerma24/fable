import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

/**
 * Socket.IO gateway stub. It answers a ping and does not carry wagers,
 * odds, or wallet commands.
 */
@WebSocketGateway({ cors: { origin: true } })
export class PlatformGateway {
  @SubscribeMessage('ping')
  ping(@MessageBody() body: unknown): { event: 'pong'; simulated: true; echo: unknown } {
    return { event: 'pong', simulated: true, echo: body ?? null };
  }
}
