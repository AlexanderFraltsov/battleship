import { GAME_FIELD_SIDE } from '../constants';

export const createGameField = () => Array(GAME_FIELD_SIDE).fill(Array(GAME_FIELD_SIDE).fill(false))
