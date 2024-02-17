import { WebSocketServer, RawData, WebSocket } from 'ws';

export type TUser = {
	id: number;
	name: string;
	password: string;
	roomId: number;
};

export type TClient = {
	id: number;
	user: TUser;
	socket: WebSocket;
};

export type TRoom = {
	roomId: number;
	roomUsers: Omit<TUser, 'password' | 'roomId'>[]
}

export type TWinner = {
	name: string;
	wins: number;
}

export enum EIncomingMessageType {
	ADD_SHIPS = 'add_ships',
	ADD_USER_TO_ROOM = 'add_user_to_room',
	ATTACK = 'attack',
	CREATE_ROOM = 'create_room',
	RANDOM_ATTACK = 'randomAttack',
	REGISTRATION = 'reg',
}

export enum EOutcomingMessageType {
	ATTACK = 'attack',
	CREATE_GAME = 'create_game',
	FINISH = 'finish',
	REGISTRATION = 'reg',
	START_GAME = 'start_game',
	TURN = 'turn',
	UPDATE_ROOM = 'update_room',
	UPDATE_WINNERS = 'update_winners',
}

export type TClientMessage = {
	id: 0;
	data: string;
	type: EIncomingMessageType;
}

export type TServerMessage = {
	id: 0;
	data: any;
	type: EOutcomingMessageType;
}

export class SocketServer {
	private server: WebSocketServer;

	private clients: TClient[] = [];

	private rooms: TRoom[] = [];

	private winners: TWinner[] = [];

	private nextIndex = 1;

	constructor(port: number) {
		this.init(port);
	}

	private init = (port: number) => {
		this.server = new WebSocketServer({ port });

		this.server.on('connection', this.handleConnect);

		this.server.on('error', (error) => {
			console.error(`Server error: ${error}`);
		})
		process.on('exit', () => {
			this.server.close();
		});
	}

	private handleConnect = (socket: WebSocket) => {
		const client: TClient = { id: this.nextIndex, socket, user: null };
		this.clients.push(client);
		this.nextIndex = this.nextIndex + 1;

		socket.on('close', (code, reason) => {
			console.log(`Client ID = ${client.id} | Closed with code ${code}, reason ${reason}`);
		});
		socket.on('open', () => {
			console.log(`Client ID = ${client.id} | Open`);
		})
		socket.on('error', (error) => this.handleError(client, error));
		socket.on('message', (message) => this.handleMessage(client, message));
	}

	private handleMessage = (client: TClient, message: RawData) => {
		try {
			const response: TClientMessage = JSON.parse(message.toString());
			const data = response.data.length > 0 ? JSON.parse(response.data) : response.data;
			console.log(`Client ID = ${client.id} | Incoming Message | Type: ${response.type} | Data: `, data);
			this.action(response.type, data, client.id);
		} catch (error) {
			this.handleError(client, error);
		}
	}

	private action = (type: EIncomingMessageType, data: any, clientId: number): void => {
		switch (type) {
			case EIncomingMessageType.ADD_SHIPS: {
				return this.addShips(data);
			}
			case EIncomingMessageType.ADD_USER_TO_ROOM: {
				return this.addUserToRoom(data);
			}
			case EIncomingMessageType.ATTACK: {
				return this.attack(data);
			}
			case EIncomingMessageType.CREATE_ROOM: {
				return this.createRoom(clientId);
			}
			case EIncomingMessageType.RANDOM_ATTACK: {
				return this.randomAttack(data);
			}
			case EIncomingMessageType.REGISTRATION: {
				return this.registration(data, clientId);
			}
		}
	}

	private handleError = (client: TClient, error: Error) => {
		console.error(`Client ID = ${client.id} | Socket error: ${error}`);
	}

	private registration = ({ name, password }: { name: string; password: string }, clientId: number): void => {
		const client = this.clients.find(client => client.id === clientId);

		const userWithSameName = this.clients.find(({ user }) => user?.name === name);
		if (userWithSameName) {
			return this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.REGISTRATION,
				data: {
					name,
					index: userWithSameName.id,
					error: true,
					errorText: 'This user is already logged in',
				}
			});
		}

		const newUser: TUser = {
			id: clientId,
			name,
			password,
			roomId: null,
		};

		client.user = newUser;
		this.sendMessage(client, {
			id: 0,
			type: EOutcomingMessageType.REGISTRATION,
			data: {
				name,
				index: clientId,
				error: false,
				errorText: '',
			}
		});
		this.sendUpdateRoom();
		this.sendUpdateWinners();
	}

	private createRoom = (clientId: number): void => {
		const { user } = this.clients.find(({ id }) => id === clientId);
		const roomId = this.rooms.length + 1;
		const room = {
			roomId,
			roomUsers: [
				{
					id: user.id,
					name: user.name,
				},
			],
		};
		user.roomId = roomId;
		this.rooms.push(room);
		this.sendUpdateRoom();
		this.sendUpdateWinners();
	}

	private attack = (data: any): void => {
		console.log('attack!');
	}
	private addShips = (data: any): void => {
		console.log('addShips!');
	}
	private addUserToRoom = ({ indexRoom }: any): void => {
		console.log('addUserToRoom!');
	}
	private randomAttack = (data: any): void => {
		console.log('randomAttack!');
	}

	private sendUpdateRoom() {
		const registeredClients = this.clients.filter(client => client.user !== null);
		for (const client of registeredClients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.UPDATE_ROOM,
				data: this.rooms.filter((room) => room.roomUsers.length === 1),
			});
		}
	}

	private sendUpdateWinners() {
		const registeredClients = this.clients.filter(client => client.user !== null);
		for (const client of registeredClients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.UPDATE_WINNERS,
				data: this.winners,
			})
		}
	}

	private sendMessage(client: TClient, message: TServerMessage): void {
		try {
  		console.log(`Client ID = ${client.id} | Outcoming Message | Type: ${message.type} | Data: `, message.data);
			const responseMessage = this.prepareResponse(message);
  		client.socket.send(responseMessage);
		} catch (error) {
			this.handleError(client, error);
		}
	}

	private prepareResponse = (message: TServerMessage): string => JSON.stringify({
		...message,
		data: JSON.stringify(message.data),
	});
}
