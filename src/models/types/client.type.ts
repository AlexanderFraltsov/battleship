import { WebSocket } from 'ws';
import { SeaBattleBot } from '../../bot/sea-battle-bot';

import { TUser } from './user.type';

export type TClient = {
	id: number;
	user: TUser;
	socket: WebSocket | SeaBattleBot;
};
