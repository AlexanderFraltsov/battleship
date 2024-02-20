import { httpServer } from './http-server/server';
import { SocketServer } from './ws-server/ws-server';
import { logger } from './logger/logger';

const HTTP_PORT = 8181;
const WS_PORT = 3000;

logger.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

logger.log(`WS server started at ws://localhost:${WS_PORT}/`);
new SocketServer(WS_PORT);
