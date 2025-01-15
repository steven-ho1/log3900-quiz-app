/* eslint-disable no-console */
import { DatabaseService } from '@app/services/database/database.service';
import { CompletedGame, LeaderboardPlayer, PlayerStats } from '@common/stats';
import { User } from '@common/user';

import { Service } from 'typedi';

@Service()
export class StatsService {
    constructor(private database: DatabaseService) {}

    initializePlayerStats(userId: string) {
        const playerStats: PlayerStats = {
            userId,
            averageCorrectAnswersPerGame: 0,
            averageTimePerGame: 0,
            winRate: 0,
            totalPoints: 0,
            totalMoney: 0,
            completedGames: [],
            totalCompletedChallenges: 0,
        };

        return playerStats;
    }
    async getUserById(userId: string): Promise<User | null> {
        const user = await this.getUserCollection().findOne({ id: userId });

        if (user) return user as unknown as User;
        return null;
    }
    async getLeaderboard(): Promise<LeaderboardPlayer[]> {
        const statsCollection = this.getStatsCollection();
        const playerStatsDocs = await statsCollection.find({}).toArray();

        const playerStats: LeaderboardPlayer[] = await Promise.all(
            playerStatsDocs.map(async (doc) => {
                const user = await this.getUserById(doc.userId);
                return {
                    username: user ? user.username : 'Unknown User', // Retrieve username or display 'Unknown User'
                    winRate: doc.winRate || 0,
                    averageTimePerGame: doc.averageTimePerGame || 0,
                    totalCompletedChallenges: doc.totalCompletedChallenges || 0,
                    totalPoints: doc.totalPoints || 0,
                    totalMoney: doc.totalMoney || 0,
                };
            }),
        );

        playerStats.sort((a, b) => b.winRate - a.winRate);

        return playerStats;
    }

    async insertPlayerStats(playerStats: PlayerStats): Promise<void> {
        await this.getStatsCollection().insertOne(playerStats);
    }

    async updateCompletionPlayerStats(userId: string, completedGame: CompletedGame): Promise<PlayerStats | null> {
        let playerStats: PlayerStats = await this.getPlayerStats(userId);
        if (!playerStats) {
            playerStats = this.initializePlayerStats(userId);
        }

        this.computeNewCompletionPlayerStats(playerStats, completedGame);
        await this.getStatsCollection().replaceOne({ userId }, playerStats, { upsert: true });
        return playerStats;
    }

    async updateChallengePlayerStats(userId: string) {
        const playerStats = await this.getPlayerStats(userId);
        playerStats.totalCompletedChallenges++;
        await this.getStatsCollection().replaceOne({ userId }, playerStats);
    }
    async addMoneyToUserStats(userId: string, amount: number): Promise<void> {
        const statsCollection = this.getStatsCollection();

        const result = await statsCollection.updateOne({ userId }, { $inc: { totalMoney: amount } });

        if (result.modifiedCount === 0) {
            throw new Error(`Failed to update totalMoney for user ${userId}`);
        }
    }

    async getPlayerStats(userId: string): Promise<PlayerStats | null> {
        const playerStats = await this.getStatsCollection().findOne({ userId });

        if (playerStats) {
            const reorderedPlayerStats = playerStats as unknown as PlayerStats;
            reorderedPlayerStats.completedGames = reorderedPlayerStats.completedGames.reverse();
            return reorderedPlayerStats;
        }
        return null;
    }

    private computeNewCompletionPlayerStats(playerStats: PlayerStats, completedGame: CompletedGame) {
        playerStats.completedGames.push(completedGame);

        let totalCorrectAnswerRatio = 0;
        let totalGameDuration = 0;
        let totalWins = 0;

        for (const game of playerStats.completedGames) {
            totalCorrectAnswerRatio += game.correctAnswerRatio;
            totalGameDuration += game.gameDuration;
            totalWins += Number(game.hasWon);
        }

        const nCompletedGames = playerStats.completedGames.length;

        playerStats.averageCorrectAnswersPerGame = totalCorrectAnswerRatio / nCompletedGames;
        playerStats.averageTimePerGame = totalGameDuration / nCompletedGames;
        playerStats.winRate = totalWins / nCompletedGames;
        playerStats.totalPoints += completedGame.earnedPoints;
    }

    private getStatsCollection() {
        return this.database.getCollection('Stats');
    }
    private getUserCollection() {
        return this.database.getCollection('Users');
    }
}
