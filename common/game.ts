export enum QuestionType {
    QCM = 'QCM',
    QRL = 'QRL',
    QRE = 'QRE',
}

export interface Choice {
    text: string;
    isCorrect: boolean;
}
export interface QstImage {
    data: string; // Base64 encoded image data
    name: string;
}
export interface Question {
    text: string;
    points: number;
    type: QuestionType;
    choices?: Choice[];
    lowerBound?: number;
    upperBound?: number;
    correctSlideAnswer?: number;
    toleranceMargin?: number;
    qstImage?: QstImage;
}
export interface Feedback {
    userId: string;
    rating: number;
    comment: string;
}

export interface Game {
    id: string;
    title: string;
    description: string;
    duration: number;
    lastModification: string;
    isVisible?: boolean;
    questions: Question[];
    isPublic: boolean;
    creator?: string;
    feedback?: Feedback[];
}

export interface GameInfo {
    name: string;
    date: string;
    numberPlayers: number;
    bestScore: number;
}
