import { type } from 'node:os';
import { WebSocketServer, RawData, WebSocket } from 'ws';

export type TUser = {
	id: number;
	name: string;
	password: string;
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

export type TShipPosition = {
	position: { x: number; y: number };
	direction: boolean;
	type: 'small' | 'medium' | 'large' | 'huge';
	length: number;
}

export type TGame = {
	gameId: number;
	gameUsers: {
		id: number;
		ships: TShipPosition[];
	}[];
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

const generateId = (): number =>
	+(Date.now().toString().slice(-6));


export class SocketServer {
	private server: WebSocketServer;

	private clients: TClient[] = [];

	private rooms: TRoom[] = [];

	private games: TGame[] = [];

	private winners: TWinner[] = [];

	constructor(port: number) {
		this.init(port);
	}

	private init = (port: number) => {
		this.server = new WebSocketServer({ port });

		this.server.on('connection', this.handleConnect);

		this.server.on('error', (error) => {
			console.error(`Server error: ${error}`);
		});

		process.on('exit', () => {
			this.server.close();
		});
	}

	private handleConnect = (socket: WebSocket) => {
		const client: TClient = { id: generateId(), socket, user: null };
		this.clients.push(client);

		socket.on('close', (code, reason) => {
			console.log(`Client ID = ${client.id} | Closed with code ${code}, reason: ${reason.toString() ?? 'Reload Page'}`);
			this.clients = this.clients.filter(({ id }) => id !== client.id)
		});
		socket.on('error', (error) => this.handleError(client, error));
		socket.on('message', (message) => this.handleMessage(client, message));
	}

	private handleMessage = (client: TClient, message: RawData) => {
		try {
			const response: TClientMessage = JSON.parse(message.toString());
			const data = response.data.length > 0 ? JSON.parse(response.data) : response.data;
			console.log(
				`Client ID = ${client.id} | Incoming Message | Type: ${response.type} | Data: `,
				JSON.stringify(data, null, 4),
			);
			this.action(response.type, data, client.id);
		} catch (error) {
			this.handleError(client, error);
		}
	}

	private action = (type: EIncomingMessageType, data: any, clientId: number): void => {
		switch (type) {
			case EIncomingMessageType.ADD_SHIPS: {
				return this.addShips(data, clientId);
			}
			case EIncomingMessageType.ADD_USER_TO_ROOM: {
				return this.addUserToRoom(data, clientId);
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
		if (this.rooms.some(room => room.roomUsers.some(user => user.id === clientId))) {
			return;
		}

		const { user } = this.clients.find(({ id }) => id === clientId);
		const roomId = generateId();
		const room = {
			roomId,
			roomUsers: [
				{
					id: user.id,
					name: user.name,
				},
			],
		};
		this.rooms.push(room);
		this.sendUpdateRoom();
		this.sendUpdateWinners();
	}

	private attack = (data: any): void => {
		console.log('attack!');
	}

	private addShips = (data: { gameId: number; indexPlayer: number; ships: TShipPosition[] }, clientId: number): void => {
		const { ships, indexPlayer } = data;

		this.games = this.games.map(game => game.gameId !== data.gameId ? game : {
			...game,
			gameUsers: game.gameUsers.map((user) => user.id !== clientId ? user: {
				...user, ships
			}),
		});

		const { gameUsers } = this.games.find(({ gameId }) => gameId === data.gameId);
		const isAllShippsSettled = gameUsers.every(({ ships }) => ships && ships.length > 0);

		if (isAllShippsSettled) {
			const clientIds = gameUsers.map(({ id }) => id);
			this.sendStartGame(clientIds, indexPlayer, ships);
			this.sendTurn(clientIds, indexPlayer);
		}
	}

	private addUserToRoom = ({ indexRoom }: { indexRoom: number }, clientId: number): void => {
		const [enemy] = this.rooms.find(room => room.roomId === indexRoom).roomUsers;
		if (enemy.id === clientId) {
			return;
		}
		this.rooms = this.rooms.filter(room => room.roomId !== indexRoom);
		this.sendUpdateRoom();
		this.sendCreateGame(clientId, enemy.id);
	}
	private randomAttack = (data: any): void => {
		console.log('randomAttack!');
	}

	private sendCreateGame(userId: number, enemyId: number) {
		const gameClients = this.clients.filter(client => client.user !== null).filter(({ user: { id } }) => id === userId || id === enemyId );
		const game: TGame = {
			gameId: generateId(),
			gameUsers: [
				{ id: userId, ships: null },
				{ id: enemyId, ships: null },
			],
		};
		this.games.push(game);
		for (const client of gameClients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.CREATE_GAME,
				data: {
					idGame: game.gameId,
					idPlayer: userId,
				},
			});
		}
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
			});
		}
	}

	private sendStartGame(clientIds: number[], currentPlayerIndex: number, ships: TShipPosition[]) {
		const clients = this.clients.filter(({ id }) => clientIds.includes(id));
		for (const client of clients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.START_GAME,
				data: {
					currentPlayerIndex,
					ships,
				},
			});
		}
	}

	private sendTurn(clientIds: number[], currentPlayer: number) {
		const clients = this.clients.filter(({ id }) => clientIds.includes(id));
		for (const client of clients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.TURN,
				data: {
					currentPlayer,
				}
			});
		}
	}

	private sendMessage(client: TClient, message: TServerMessage): void {
		try {
			if (client.socket.readyState === WebSocket.OPEN) {
				console.log(
					`Client ID = ${client.id} | Outcoming Message | Type: ${message.type} | Data: `,
					JSON.stringify(message.data, null, 4),
				);
				const responseMessage = this.prepareResponse(message);
				client.socket.send(responseMessage);
			}
		} catch (error) {
			this.handleError(client, error);
		}
	}

	private prepareResponse = (message: TServerMessage): string => JSON.stringify({
		...message,
		data: JSON.stringify(message.data),
	});
}
