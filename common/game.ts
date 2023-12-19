export enum QuestionType {
    QCM = 'QCM',
    QRL = 'QRL',
}

export interface Choice {
    text: string;
    isCorrect: boolean;
}

export interface Question {
    text: string;
    points: number;
    type: QuestionType;
    choices?: Choice[];
}

export interface Game {
    id: string;
    title: string;
    description: string;
    duration: number;
    lastModification: string;
    isVisible?: boolean;
    questions: Question[];
}

export interface GameInfo {
    name: string;
    date: string;
    numberPlayers: number;
    bestScore: number;
}
