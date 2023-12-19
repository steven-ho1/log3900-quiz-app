import { Game, QuestionType } from './game';

export type SocketId = string;
export type Pin = string;

export const REQUIRED_PIN_LENGTH = 4;
export const ACTIVE_PLAYERS_TEXT = 'Actifs';
export const INACTIVE_PLAYERS_TEXT = 'Inactifs';
export const ZERO = 0;
export const FIFTY = 50;
export const HUNDRED = 100;
export const indexFind = -1;

export interface LobbyDetails {
    isLocked: boolean;
    players: Player[];
    bannedNames?: string[];
    game?: Game;
    bonusRecipient?: string;
    histogram?: { [key: string]: number };
    chat: Message[];
    qrlAnswers: Answer[];
    currentQuestionType?: QuestionType;
}
export enum PlayerColor {
    Red = 'red',
    Yellow = 'yellow',
    Green = 'green',
    Black = 'black',
}
export interface Player {
    socketId: SocketId;
    name: string;
    answerSubmitted?: boolean;
    score: number;
    bonusTimes?: number;
    activityState: PlayerColor;
    isAbleToChat: boolean;
    isTyping: boolean;
}

export interface Message {
    sender: string;
    content: string;
    time: string;
}

export interface Answer {
    submitter: string;
    questionType: QuestionType;
    isCorrect?: boolean;
    text?: string;
    grade: number | null;
}
