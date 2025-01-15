/* eslint-disable no-console */
/* eslint-disable max-params */
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TOKEN } from '@app/constants/auth';
import { BASIC_CONSOLATION_PRIZE, BASIC_VICTORY_PRIZE } from '@app/constants/in-game';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { ShopService } from '@app/services/shop/shop.service';
import { StatsService } from '@app/services/stats/stats.service';
import { LobbyDetails, Player } from '@common/lobby';
import { Challenge } from '@common/stats';
import { Badge, Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { finalize, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-end-result',
    templateUrl: './end-result.component.html',
    styleUrls: ['./end-result.component.scss'],
})
export class EndResultComponent implements OnInit, OnDestroy {
    @Input() isObserver: boolean = false;
    lobby: LobbyDetails;
    players: Player[] = [];
    currentQuestion: string = '';
    correctAnswers: string[];
    allHistogramData: { [questionId: number]: { [key: string]: number } } = {};
    currentQuestionId: number = 0;
    numberOfQuestions: number;
    hasWon: boolean | undefined;
    reward: number | undefined;
    challenge: Challenge;
    challengeCompleted: boolean;
    badges: Badge[] = [];
    rating: number | null = null;
    comment: string;
    hasEvaluated: boolean = false;
    currentLanguage: string;

    private authService: AuthService = inject(AuthService);
    private shopService: ShopService = inject(ShopService);
    private http: HttpClient = inject(HttpClient);
    private badgeUpdateQueue: Promise<void> = Promise.resolve();

    constructor(
        private clientSocket: ClientSocketService,
        private gameService: GameHandlingService,
        private statsService: StatsService,
        private snackBar: MatSnackBar,
        private translate: TranslateService,
    ) {
        this.challenge = this.gameService.challenge as Challenge;
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get wallet() {
        return this.authService.user?.wallet;
    }

    get isOrganizer() {
        return this.clientSocket.isOrganizer;
    }

    ngOnInit(): void {
        this.badges = this.authService.user?.badges ?? [];
        this.clientSocket.hasGameEnded = true;
        this.configureBaseSocketFeatures();
        this.clientSocket.socket.emit('getPlayers');
        this.allHistogramData = this.gameService.getAllHistogramData();
        this.updateCurrentQuestionText();
        this.gameService.resetHistogramDataForQuestion();
        this.gameService.setCurrentQuestionId(this.currentQuestionId);
        this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
        this.numberOfQuestions = Object.keys(this.allHistogramData).length;
    }
    updateCurrentQuestionText(): void {
        this.currentQuestion = this.gameService.currentGame.questions[this.currentQuestionId].text;
    }

    previousQuestion(): void {
        if (this.currentQuestionId >= 1) {
            this.currentQuestionId--;
            this.gameService.setCurrentQuestionId(this.currentQuestionId);
            this.updateCurrentQuestionText();
            this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
        }
    }

    nextQuestion(): void {
        const maxQuestionId = --Object.keys(this.allHistogramData).length;
        if (this.currentQuestionId < maxQuestionId) {
            this.currentQuestionId++;
            this.gameService.setCurrentQuestionId(this.currentQuestionId);
            this.updateCurrentQuestionText();
            this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
        }
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('latestPlayerList');
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('latestPlayerList', async (lobbyDetails: LobbyDetails) => {
            this.lobby = lobbyDetails;
            this.checkIfUserHasEvaluated();

            if (!this.players.length) {
                this.players = lobbyDetails.players.filter((player: Player) => player.name !== 'Organisateur');
                this.players.sort((a, b) => b.score - a.score);
                if (!this.clientSocket.isOrganizer && !this.isObserver) {
                    this.submitStats();
                    this.submitReward();
                }
            }
        });
    }
    checkIfUserHasEvaluated(): void {
        const evaluation = this.lobby.game?.feedback?.find((feedback) => feedback.userId === this.authService.user?.id);
        this.hasEvaluated = !!evaluation;
    }
    submitEvaluation(): void {
        if (!this.rating) {
            this.snackBar.open(
                this.currentLanguage === Language.French
                    ? 'Veuillez fournir une note avant de soumettre.'
                    : 'Please provide a rating before submitting.',
                '',
                {
                    duration: 3000,
                    verticalPosition: 'top',
                },
            );
            return;
        }

        if (this.hasEvaluated) {
            this.snackBar.open(
                this.currentLanguage === Language.French ? 'Vous avez déjà évalué ce quiz.' : 'You have already rated this quiz.',
                '',
                {
                    duration: 3000,
                    verticalPosition: 'top',
                },
            );
            return;
        }

        const evaluationData = {
            gameId: this.lobby.game?.id,
            userId: this.authService.user?.id,
            rating: this.rating,
            comment: this.comment,
        };

        const url = `${environment.serverBaseUrl}/api/games/${evaluationData.gameId}/feedback`;
        this.http.post(url, evaluationData, this.setAuthorizationHeader()).subscribe({
            next: () => {
                this.hasEvaluated = true; // Set to true after successful submission
                this.rating = null;
                this.comment = '';
                this.snackBar.open(this.currentLanguage === Language.French ? 'Merci pour votre évaluation!' : 'Thank you for your feedback!', '', {
                    duration: 3000,
                    verticalPosition: 'top',
                });
            },
            error: (error: HttpErrorResponse) => {
                console.error("Erreur lors de la soumission de l'évaluation:", error);
            },
        });
    }

    private submitStats() {
        this.statsService.updatePlayerStats(this.players).subscribe({
            next: () => {
                return;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
            },
        });
    }

    private submitReward() {
        const activePlayers = this.players.filter((player) => player.role !== 'observer');
        const maxScore = Math.max(...activePlayers.map((player) => player.score));
        const winners = activePlayers.filter((player) => player.score === maxScore);

        // const maxScore = Math.max(...this.players.map((player) => player.score));
        // const winners = this.players.filter((player) => player.score === maxScore);
        this.hasWon = winners.some((winner) => winner.name === this.authService.user?.username);

        const entryFeeVictoryPrize = (this.lobby.entryFeeSum * 2) / 3;
        const entryFeeConsolationPrize = this.lobby.entryFeeSum / 3;

        if (this.hasWon) {
            this.reward = (BASIC_VICTORY_PRIZE + entryFeeVictoryPrize) / winners.length;
            // this.updateBadgeProgress('game-king');
            // this.updateBadgeProgress('game-won');
        } else {
            const nLosers = this.players.length - winners.length;
            this.reward = BASIC_CONSOLATION_PRIZE + entryFeeConsolationPrize / nLosers;
        }

        this.shopService
            .rewardUser(this.reward)
            .pipe(
                finalize(async () => {
                    if (this.challenge.isCompleted) {
                        this.statsService
                            .submitChallengeCompletion(this.challenge)
                            .pipe(
                                finalize(async () => {
                                    await this.updateBadgesAfterGame();
                                }),
                            )
                            .subscribe({
                                next: (userAfterChallenge: User) => {
                                    this.authService.user = userAfterChallenge;
                                },
                                error: () => {
                                    return;
                                },
                            });
                    } else {
                        await this.updateBadgesAfterGame();
                    }
                }),
            )
            .subscribe({
                next: (user: User) => {
                    this.authService.user = user;
                },
                error: () => {
                    return;
                },
            });
    }
    // private async delay(ms: number): Promise<void> {
    //     return new Promise((resolve) => setTimeout(resolve, ms));
    // }

    private async updateBadgesAfterGame(): Promise<void> {
        // const delayBadge = 50;
        const maxScore = Math.max(...this.players.map((player) => player.score));
        const winners = this.players.filter((player) => player.score === maxScore);
        const hasWon = winners.some((winner) => winner.name === this.authService.user?.username);

        if (hasWon) {
            const user = this.authService.user;
            if (user) {
                const gameWonBadge = user.badges.find((b) => b.id === 'game-won');
                if (gameWonBadge && gameWonBadge.userProgress === 0) {
                    this.updateBadgeProgress('game-won');
                }

                // await this.delay(delayBadge);

                const gameKingBadge = user.badges.find((b) => b.id === 'game-king');
                if (gameKingBadge && gameKingBadge.userProgress < gameKingBadge.goal) {
                    this.updateBadgeProgress('game-king');
                }
            }
        }
    }
    private setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }

    private updateBadgeProgress(badgeId: string): void {
        const user = this.authService.user;
        if (!user) return;

        const badge = user.badges.find((b) => b.id === badgeId);
        if (badge && badge.userProgress < badge.goal) {
            badge.userProgress += 1;

            const url = `${environment.serverBaseUrl}/api/users/${user.id}/badges/${badgeId}`;

            // Ajouter la mise à jour à la file d'attente
            this.badgeUpdateQueue = this.badgeUpdateQueue.then(async () =>
                firstValueFrom(this.http.patch<User>(url, { userProgress: badge.userProgress }, this.setAuthorizationHeader()))
                    .then((updatedUser) => {
                        if (updatedUser) {
                            this.authService.user = updatedUser;
                            this.badges = updatedUser.badges;
                        } else {
                            console.error("Erreur: l'utilisateur mis à jour est undefined.");
                        }
                    })
                    .catch((error: HttpErrorResponse) => {
                        console.error('Erreur lors de la mise à jour du badge:', error);
                    }),
            );
        }
    }
}
