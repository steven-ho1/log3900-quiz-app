import { QuestionType } from './game';

export interface PlayerStats {
    userId: string;
    averageCorrectAnswersPerGame: number;
    averageTimePerGame: number;
    winRate: number;
    totalPoints: number;
    totalMoney: number;
    completedGames: CompletedGame[];
    totalCompletedChallenges: number;
}
export interface LeaderboardPlayer {
    username: string;
    winRate: number;
    averageTimePerGame: number;
    totalCompletedChallenges: number;
    totalPoints: number;
    totalMoney: number;
}

export interface CompletedGame {
    correctAnswerRatio: number;
    gameDuration: number;
    earnedPoints: number;
    completionDate?: string;
    hasWon: boolean;
}

export interface Challenge {
    id: string;
    description: string;
    questionType: QuestionType;
    reward: number;
    isCompleted: boolean;
}
