import { TUser } from './user.type';

export type TRoom = {
	roomId: number;
	roomUsers: Omit<TUser, 'password' | 'roomId'>[]
}
