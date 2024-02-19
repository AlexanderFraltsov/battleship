import { WebSocketServer, RawData, WebSocket } from 'ws';

import {
	EAttackResultStatus,
	EIncomingMessageType,
	EOutcomingMessageType,
	TAttackResult,
	TClient,
	TRoom,
	TShipPosition,
	TUser,
	TWinner,
} from '../models';
import { createGameField, generateId, ShipUtils } from '../utils';

export type TGame = {
	gameId: number;
	gameUsers: {
		id: number;
		shipsKilled: number;
		ships: TShipPosition[];
		attackResults: boolean[][];
	}[];
	currentPlayerIndex: number;
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
				return this.addShips(data);
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

	private attack = ({ gameId, x, y, indexPlayer }: {
		gameId: number;
		x: number;
		y: number;
		indexPlayer: number;
	}): void => {
		const game = this.games.find(game => game.gameId === gameId);
		if (game && game.currentPlayerIndex === indexPlayer) {
			const attackedUser = game.gameUsers.find(({ id }) => id !== indexPlayer);
			if (!attackedUser.attackResults[x][y]) {
				const feedback = ShipUtils.getAttackFeedback(x, y, attackedUser.ships, attackedUser.attackResults);
				feedback.forEach(({ position }) => {
					attackedUser.attackResults = attackedUser.attackResults
						.map((row, rowIndex) => row.map(
							(cell, cellIndex) => rowIndex === position.x && cellIndex === position.y ? true : cell
						));
				});

				if (feedback.length > 0) {
					const clientIds = game.gameUsers.map(({ id }) => id);
					this.sendAttackFeedback(clientIds, indexPlayer, feedback);
					if (feedback.some(({ status }) => status === EAttackResultStatus.KILLED)) {
						game.gameUsers = game.gameUsers.map(user => user.id !== indexPlayer ? user : {
							...user,
							shipsKilled: user.shipsKilled + 1,
						});
					}

					if (game.gameUsers.some(({ shipsKilled }) => shipsKilled >= 10)) {
						const winnerId = game.gameUsers.find(({ shipsKilled }) => shipsKilled >= 10).id;
						const { name } = this.clients.find(({ id }) => id === winnerId).user;
						if (this.winners.some((winner) => winner.name === name)) {
							this.winners = this.winners.map(winner => winner.name !== name ? winner : { ...winner, wins: winner.wins + 1 });
						} else {
							this.winners.push({ name, wins: 1 });
						}
						this.sendFinish(winnerId);
						this.sendUpdateWinners();
					} else {
						if (!feedback.some(({ status }) => [EAttackResultStatus.SHOT, EAttackResultStatus.KILLED].includes(status))) {
							this.sendTurn(gameId, clientIds, clientIds.find((id) => id !== indexPlayer));
						} else {
							this.sendTurn(gameId, clientIds, indexPlayer);
						}
					}
				}
			}
		}
	}

	private randomAttack = ({ gameId, indexPlayer }: {
		gameId: number;
		indexPlayer: number;
	}): void => {
		const game = this.games.find(game => game.gameId === gameId);
		if (game && game.currentPlayerIndex === indexPlayer) {
			const attackedUser = game.gameUsers.find(({ id }) => id !== indexPlayer);
			const { x, y } = ShipUtils.getRandomField(attackedUser.attackResults);
			this.attack({ x, y, gameId, indexPlayer })
		}
	}

	private addShips = (data: { gameId: number; indexPlayer: number; ships: TShipPosition[] }): void => {
		const { ships, indexPlayer } = data;

		this.games = this.games.map(game => game.gameId !== data.gameId ? game : {
			...game,
			gameUsers: game.gameUsers.map((user) => user.id !== indexPlayer ? user: {
				...user, ships
			}),
			currentPlayerIndex: indexPlayer,
		});

		const { gameUsers } = this.games.find(({ gameId }) => gameId === data.gameId);
		const isAllShippsSettled = gameUsers.every(({ ships }) => ships && ships.length > 0);

		if (isAllShippsSettled) {
			const clientIds = gameUsers.map(({ id }) => id);
			this.sendStartGame(data.gameId);
			this.sendTurn(data.gameId, clientIds, indexPlayer);
		}
	}

	private addUserToRoom = ({ indexRoom }: { indexRoom: number }, clientId: number): void => {
		const [enemy] = this.rooms.find(room => room.roomId === indexRoom).roomUsers;
		if (enemy.id === clientId) {
			return;
		}
		this.rooms = this.rooms.filter(room => room.roomId !== indexRoom);
		this.sendUpdateRoom();
		this.sendCreateGame(clientId, enemy.id, indexRoom);
	}

	private sendAttackFeedback(clientIds: number[], currentPlayer: number, feedback: TAttackResult[]) {
		const clients = this.clients.filter(({ id }) => clientIds.includes(id));
		for (const client of clients) {
			for (const result of feedback) {
				this.sendMessage(client, {
					id: 0,
					type: EOutcomingMessageType.ATTACK,
					data: {
						currentPlayer,
						...result,
					}
				});
			}
		}
	}

	private sendCreateGame(userId: number, enemyId: number, roomId: number) {
		const gameClients = this.clients.filter(client => client.user !== null).filter(({ user: { id } }) => id === userId || id === enemyId );
		const game: TGame = {
			gameId: roomId,
			gameUsers: [
				{ id: userId, ships: null, shipsKilled: 0, attackResults: createGameField() },
				{ id: enemyId, ships: null, shipsKilled: 0, attackResults: createGameField() },
			],
			currentPlayerIndex: null,
		};
		this.games.push(game);
		for (const client of gameClients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.CREATE_GAME,
				data: {
					idGame: game.gameId,
					idPlayer: client.id,
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

	private sendStartGame(gameId: number) {
		const game = this.games.find(game => game.gameId === gameId);
		const clientIds = game.gameUsers.map(({ id }) => id);
		const clients = this.clients.filter(({ id }) => clientIds.includes(id));
		for (const client of clients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.START_GAME,
				data: {
					currentPlayerIndex: client.id,
					ships: game.gameUsers.find(({ id }) => id === client.id).ships,
				},
			});
		}
	}

	private sendTurn(gameId: number, clientIds: number[], currentPlayer: number) {
		const clients = this.clients.filter(({ id }) => clientIds.includes(id));
		this.games = this.games.map(game => game.gameId !== gameId ? game : {
			...game,
			currentPlayerIndex: currentPlayer,
		})
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

	private sendFinish(winPlayer: number): void {
		const registeredClients = this.clients.filter(client => client.user !== null);
		for (const client of registeredClients) {
			this.sendMessage(client, {
				id: 0,
				type: EOutcomingMessageType.FINISH,
				data: {
					winPlayer,
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
