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
    started: boolean;
    players: Player[];
    bannedNames?: string[];
    game?: Game;
    bonusRecipient?: string;
    histogram?: { [key: string]: number };
    qrlAnswers: Answer[];
    qreAnswers: QreAnswer[];
    qcmAnswers: QcmAnswer[];
    currentQuestionType?: QuestionType;
    currentQuestionNumber?: number;
    pin: Pin;
    entryFee: number;
    entryFeeSum: number;
    friendOnly: boolean;
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
    avatar?: string;
    role?: string;
}

export interface Answer {
    submitter: string;
    questionType: QuestionType;
    isCorrect?: boolean;
    text?: string;
    grade: number | null;
}
export interface QreAnswer {
    submitter: string;
    questionType: QuestionType.QRE;
    value: number;
}
export interface QcmAnswer {
    submitter: string;
    questionType: QuestionType.QCM;
    selectedChoices?: string[];
}
