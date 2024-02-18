import { WebSocket } from 'ws';

import { TUser } from './user.type';

export type TClient = {
	id: number;
	user: TUser;
	socket: WebSocket;
};
