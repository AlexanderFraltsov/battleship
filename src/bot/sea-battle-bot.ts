import {
	EIncomingMessageType,
	EOutcomingMessageType,
	TClientMessage,
	TServerMessage,
	TShipPosition
} from '../models';
import { ShipUtils } from '../utils/ship.utils';
import { CustomSubject } from '../subject/custom-subject';
import { BOT_NAME, BOT_TURN_TIMEOUT } from '../constants';

export class SeaBattleBot {
	public readonly name = BOT_NAME;

	public readonly password = BOT_NAME;

	public id: number;

	private ships: TShipPosition[];

	public events = new CustomSubject<TClientMessage>();

	private gameId: number;

	readonly readyState = 1;

	constructor(id: number) {
		this.id = id;
		this.ships = ShipUtils.getRandomShipsTemplate()
	}

	public send(message: string) {
		const parsed = this.parseMessage(message);
		switch (parsed.type) {
			case EOutcomingMessageType.CREATE_GAME: {
				this.gameId = parsed.data.idGame;
				this.events.next({
					id: 0,
					type: EIncomingMessageType.ADD_SHIPS,
					data: JSON.stringify({
						gameId: this.gameId,
						indexPlayer: this.id,
						ships: this.ships,
					})
				})
				return;
			}
			case EOutcomingMessageType.TURN: {
				if (parsed.data.currentPlayer === this.id) {
					setTimeout(() => {
						this.events.next({
							id: 0,
							type: EIncomingMessageType.RANDOM_ATTACK,
							data: JSON.stringify({
								gameId: this.gameId,
								indexPlayer: this.id,
							}),
						})
					}, BOT_TURN_TIMEOUT);
				}
				return;
			}
			case EOutcomingMessageType.FINISH: {
				this.events.next({
					id: 0,
					type: EIncomingMessageType.BOT_CLOSE,
					data: '',
				});
				return;
			}
		}
	}

	private parseMessage = (message: string): TServerMessage => {
		const response = JSON.parse(message);
		return {
			...response,
			data: JSON.parse(response.data),
		};
	}
}
