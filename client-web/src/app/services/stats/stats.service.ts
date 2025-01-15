import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { Player } from '@common/lobby';
import { Challenge, CompletedGame, LeaderboardPlayer, PlayerStats } from '@common/stats';
import { User } from '@common/user';
import { StatusCodes } from 'http-status-codes';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

export const S_MS_CONVERSION = 1000;
export const MIN_S_CONVERSION = 60;
const FOUR_DECIMALS_FACTOR = 10000;

@Injectable({
    providedIn: 'root',
})
export class StatsService {
    private currentGameStats: CompletedGame = { correctAnswerRatio: 0, gameDuration: 0, earnedPoints: 0, hasWon: false };
    private nGoodAnswers: number = 0;
    private nQuestionsAnswered: number = 0;
    private startTime: Date | null = null;
    private endTime: Date | null = null;
    private playerStats: PlayerStats | null | undefined = undefined;

    constructor(
        private httpClient: HttpClient,
        private authService: AuthService,
        private snackBar: MatSnackBar,
    ) {}

    getPlayerStats(): PlayerStats | null | undefined {
        return this.playerStats;
    }

    loadPlayerStats() {
        this.httpClient
            .get<PlayerStats>(
                `${environment.serverBaseUrl}/api/users/${(this.authService.user as User).id}/stats`,
                this.authService.setAuthorizationHeader(),
            )
            .pipe(catchError(this.handleError))
            .subscribe({
                next: (playerStats: PlayerStats) => {
                    this.playerStats = playerStats;
                },
                error: (error: HttpErrorResponse) => {
                    if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
                    else this.playerStats = null;
                },
            });
    }

    updatePlayerStats(players?: Player[]) {
        this.computeAnswerRatio();
        this.computeGameDuration();

        // players passés seulement dans vue des résultats
        if (players) this.computeWinner(players);

        return this.httpClient
            .post<void>(
                `${environment.serverBaseUrl}/api/users/${(this.authService.user as User).id}/stats`,
                this.currentGameStats,
                this.authService.setAuthorizationHeader(),
            )
            .pipe(catchError(this.handleError));
    }

    submitChallengeCompletion(challenge: Challenge) {
        return this.httpClient
            .post<User>(
                `${environment.serverBaseUrl}/api/users/${(this.authService.user as User).id}/stats/challenges`,
                challenge,
                this.authService.setAuthorizationHeader(),
            )
            .pipe(catchError(this.handleError));
    }

    resetGameStats() {
        this.currentGameStats = { correctAnswerRatio: 0, gameDuration: 0, earnedPoints: 0, hasWon: false };
        this.nGoodAnswers = 0;
        this.nQuestionsAnswered = 0;
        this.startTime = null;
        this.endTime = null;
    }

    resetPlayerStats() {
        this.playerStats = undefined;
    }

    setGameStartTime() {
        this.startTime = new Date();
    }

    saveReward(isAnswerCorrect: boolean, rewardedPoints: number) {
        if (isAnswerCorrect) {
            this.nGoodAnswers++;
            this.currentGameStats.earnedPoints += rewardedPoints;
        }

        this.nQuestionsAnswered++;
    }
    getLeaderboard(): Observable<LeaderboardPlayer[]> {
        return this.httpClient.get<LeaderboardPlayer[]>(
            `${environment.serverBaseUrl}/api/users/leaderboard`,
            this.authService.setAuthorizationHeader(),
        );
    }

    private computeAnswerRatio() {
        // Évite de diviser par 0 à cause d'un abandon
        if (this.nQuestionsAnswered === 0) return;
        this.currentGameStats.correctAnswerRatio = this.nGoodAnswers / this.nQuestionsAnswered;
    }

    private computeGameDuration() {
        this.endTime = new Date();

        const gameDurationMinutes = (this.endTime.getTime() - (this.startTime as Date).getTime()) / S_MS_CONVERSION / MIN_S_CONVERSION;
        const roundedGameDuration = Math.round(gameDurationMinutes * FOUR_DECIMALS_FACTOR) / FOUR_DECIMALS_FACTOR;

        this.currentGameStats.gameDuration = roundedGameDuration;
    }

    private computeWinner(players: Player[]) {
        const maxScore = Math.max(...players.map((player) => player.score));
        const winners = players.filter((player) => player.score === maxScore);
        const hasWon = winners.some((winner) => winner.name === this.authService.user?.username);
        this.currentGameStats.hasWon = hasWon;
    }

    private handleError = (error: HttpErrorResponse) => {
        // Network error
        if (error.error instanceof ProgressEvent) {
            this.snackBar.open(ErrorMessage.NetworkError, '', SNACK_BAR_ERROR_CONFIGURATION);
        } else if (error.status === StatusCodes.INTERNAL_SERVER_ERROR) {
            this.snackBar.open(ErrorMessage.UnexpectedError, '', SNACK_BAR_ERROR_CONFIGURATION);
        }

        return throwError(() => error);
    };
}
