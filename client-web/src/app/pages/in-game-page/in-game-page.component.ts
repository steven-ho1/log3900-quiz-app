/* eslint-disable max-lines */
/* eslint-disable max-params */
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { PANIC_SOUNDS } from '@app/constants/audio';
import { Route } from '@app/constants/enums';
import { AnswerValidatorService } from '@app/services/answer-validator/answer-validator.service';
import { AudioService } from '@app/services/audio/audio.service';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { StatsService } from '@app/services/stats/stats.service';
import { TimerService } from '@app/services/timer/timer.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { ACTIVE_PLAYERS_TEXT, Answer, INACTIVE_PLAYERS_TEXT, indexFind, LobbyDetails, Player, QcmAnswer, QreAnswer } from '@common/lobby';
import { Language } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

import { Subscription } from 'rxjs/internal/Subscription';

@Component({
    selector: 'app-in-game-page',
    templateUrl: './in-game-page.component.html',
    styleUrls: ['./in-game-page.component.scss'],
})
export class InGamePageComponent implements OnInit, OnDestroy {
    backgroundImage;
    isObserver: boolean = false;
    currentGame: Game;
    currentQuestion: string = '';
    currentQuestionScore: number;
    currentQuestionImg: string;
    score: number;
    showResults: boolean = false;
    histogramData: { [key: string]: number };
    correctAnswers: string[];
    currentLanguage: string;
    players: Player[] = [];
    qrlAnswers: Answer[] = [];
    qreAnswers: QreAnswer[] = [];
    qcmAnswers: QcmAnswer[] = [];
    observerCount: number = 0;

    selectedPlayer: Player | null = null;
    currentQuestionType: string;
    private histogramQrlSubscription: Subscription;
    private subscriptionScore: Subscription;
    private questionSubscription: Subscription;
    private histogramSubscription: Subscription;
    private routeController: RouteControllerService = inject(RouteControllerService);
    private timer: TimerService = inject(TimerService);
    private dialog: MatDialog = inject(MatDialog);
    private answerValidator: AnswerValidatorService = inject(AnswerValidatorService);
    private audio: AudioService = inject(AudioService);
    private authService: AuthService = inject(AuthService);
    private statsService: StatsService = inject(StatsService);
    private translate: TranslateService = inject(TranslateService);
    // eslint-disable-next-line @typescript-eslint/member-ordering
    protected slideAnswerForm: FormControl = this.answerValidator.slideAnswerForm;

    constructor(
        private gameService: GameHandlingService,
        private clientSocket: ClientSocketService,
        private route: ActivatedRoute,
        private router: Router,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get isOrganizer() {
        return this.clientSocket.isOrganizer;
    }

    get isQuestionTransition(): boolean {
        return this.timer.isQuestionTransition;
    }

    get isCurrentQuestionQre(): boolean {
        return this.gameService.isCurrentQuestionQre();
    }

    get answer() {
        return this.gameService.getCorrectAnswersForCurrentQuestionQRE()[1];
    }

    get tolerance() {
        return this.gameService.getCorrectAnswersForCurrentQuestionQRE()[3];
    }

    get transitionCount(): number {
        return this.timer.transitionCount;
    }

    get transitionMessage(): string {
        return this.timer.transitionMessage;
    }

    get isEvaluationPhase(): boolean {
        return this.answerValidator.isEvaluationPhase;
    }

    ngOnInit(): void {
        this.route.queryParams.subscribe((params) => {
            this.isObserver = params['observer'] === 'true';
            this.answerValidator.isObserver = this.isObserver; // Pass the observer status
            this.clientSocket.socket.on('updateCounts', (counts: { observerCount: number }) => {
                this.observerCount = counts.observerCount;
                this.clientSocket.socket.emit('socketInteracted');
            });
        });

        if (this.isObserver) {
            this.currentGame = this.gameService.currentGame;

            this.configureBaseSocketFeatures();
        } else {
            this.setGameStartTime();

            this.currentGame = this.gameService.currentGame;
            this.gameService.setCurrentQuestionId(0);
            this.currentQuestion = this.currentGame.questions[this.gameService.currentQuestionId].text;
            this.currentQuestionScore = this.currentGame.questions[this.gameService.currentQuestionId].points;
            this.currentQuestionImg = this.currentGame.questions[this.gameService.currentQuestionId].qstImage?.data || '';

            this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
            this.gameService.setScore(0);

            // Subscribe to changes in questions
            this.questionSubscription = this.gameService.currentQuestion$.subscribe({
                next: () => {
                    this.currentQuestion = this.currentGame.questions[this.gameService.currentQuestionId].text;
                    this.currentQuestionImg = this.currentGame.questions[this.gameService.currentQuestionId].qstImage?.data || '';
                },
                error: () => {
                    return;
                },
            });

            this.subscriptionScore = this.gameService.score$.subscribe({
                next: (updatedScore) => {
                    this.score = updatedScore;
                    this.clientSocket.socket.emit('submitScore', updatedScore);
                },
                error: () => {
                    return;
                },
            });
        }
        if (!this.isObserver) {
            this.histogramSubscription = this.clientSocket.listenUpdateHistogram().subscribe({
                next: (data) => {
                    if (this.gameService.isCurrentQuestionQcm()) {
                        this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
                        this.histogramData = data;
                        this.gameService.updateHistogramDataForQuestion(this.gameService.currentQuestionId, data);
                    } else {
                        const firstValueToFind = ACTIVE_PLAYERS_TEXT;
                        const secondValueToFind = INACTIVE_PLAYERS_TEXT;
                        this.histogramData = data;

                        if (!data) {
                            return;
                        }
                        const histogramKeys = Object.keys(this.histogramData);
                        const index = histogramKeys.findIndex((key) => key === firstValueToFind || key === secondValueToFind);

                        if (index !== indexFind) {
                            // ACTIVE_PLAYERS_TEXT et INACTIVE_PLAYERS_TEXT trouver on remplace alors
                            const histogramUpdateData: { [key: string]: number } = {};
                            histogramUpdateData['0%'] = 0;
                            histogramUpdateData['50%'] = 0;
                            histogramUpdateData['100%'] = 0;
                            this.gameService.updateHistogramDataForQuestion(this.gameService.currentQuestionId, histogramUpdateData);
                        } else {
                            this.gameService.updateHistogramDataForQuestion(this.gameService.currentQuestionId, data);
                        }
                    }
                },
                error: () => {
                    return;
                },
            });

            this.histogramQrlSubscription = this.clientSocket.listenQrlUpdateHistogram().subscribe({
                next: (data) => {
                    this.histogramData = data;
                    this.gameService.updateHistogramDataForQuestion(this.gameService.currentQuestionId, data);
                },
                error: () => {
                    return;
                },
            });

            this.clientSocket.socket.on('showResults', () => {
                this.showResults = true;
            });

            this.clientSocket.socket.on('panicMode', () => {
                this.timer.isPanicModeEnabled = true;
                this.audio.play(PANIC_SOUNDS);
            });
        }
    }

    ngOnDestroy(): void {
        if (!this.isObserver && !this.isOrganizer && !this.showResults) this.submitStats();

        if (this.subscriptionScore) {
            this.subscriptionScore.unsubscribe();
        }

        if (this.questionSubscription) {
            this.questionSubscription.unsubscribe();
        }

        if (this.histogramSubscription) {
            this.histogramSubscription.unsubscribe();
        }

        if (this.histogramQrlSubscription) {
            this.histogramQrlSubscription.unsubscribe();
        }

        this.timer.reset();
        this.clientSocket.socket.removeAllListeners('showResults');
        this.clientSocket.socket.removeAllListeners('panicMode');
        this.clientSocket.socket.removeAllListeners('countdownEnd');
        this.clientSocket.socket.removeAllListeners('noPlayers');
        this.clientSocket.resetPlayerInfo();
        this.routeController.setRouteAccess(Route.InGame, false);
        this.clientSocket.players = [];
        this.audio.pause();
        this.statsService.resetGameStats();
        this.gameService.resetInGameData();
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('currentQuestionUpdated', (currentQuestionNumber: number) => {
            this.gameService.setCurrentQuestionId(currentQuestionNumber);
            this.currentGame = this.gameService.currentGame;
            this.currentQuestion = this.currentGame.questions[this.gameService.currentQuestionId].text;
            this.currentQuestionScore = this.currentGame.questions[this.gameService.currentQuestionId].points;
            this.currentQuestionImg = this.currentGame.questions[this.gameService.currentQuestionId].qstImage?.data || '';
            this.qrlAnswers = [];
            this.qreAnswers = [];
            this.qcmAnswers = [];

            this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();

            // this.setQuestion(currentQuestionNumber);
        });
        this.clientSocket.socket.on('latestPlayerList', (lobbyDetails: LobbyDetails) => {
            this.players = lobbyDetails.players.filter((player) => player.role !== 'observer');
            this.qrlAnswers = lobbyDetails.qrlAnswers;
        });
        this.clientSocket.socket.on('latestLobbyData', (lobbyDetails: LobbyDetails) => {
            this.players = lobbyDetails.players.filter((player) => player.role !== 'observer');
            this.qrlAnswers = lobbyDetails.qrlAnswers;
            this.qreAnswers = lobbyDetails.qreAnswers;
            this.qcmAnswers = lobbyDetails.qcmAnswers;
        });
        this.clientSocket.socket.on('showResults', () => {
            this.showResults = true;
        });
    }

    setGameStartTime() {
        if (!this.isOrganizer) this.statsService.setGameStartTime();
    }

    onUpdateQuestionScore(score: number) {
        this.currentQuestionScore = score;
    }
    selectPlayer(player: Player): void {
        if (player.role !== 'observer') {
            this.selectedPlayer = player;
        }
        if (player.role === 'Organisateur') {
            this.selectedPlayer = null;
            this.clientSocket.socket.emit('getPlayers');
        }
    }

    abandonGame(): void {
        if (this.showResults) {
            this.router.navigate([Route.MainMenu]);
            return;
        }

        this.dialog
            .open(ConfirmationPopupComponent, {
                backdropClass: 'backdropBackground',
                disableClose: true,
                data: {
                    title: this.currentLanguage === Language.French ? 'Abandon de partie' : 'Leaving the game',
                    description:
                        this.currentLanguage === Language.French
                            ? 'Voulez-vous vraiment quitter la partie?'
                            : 'Do you really want to leave the game?',
                    primaryAction: this.currentLanguage === Language.French ? 'Quitter' : 'Leave',
                },
            })
            .afterClosed()
            .subscribe({
                next: (isLeaving: boolean) => {
                    if (isLeaving) {
                        if (this.gameService.gameMode === GameMode.Testing) {
                            this.router.navigate([Route.GameCreation]);
                            return;
                        }
                        if (this.isObserver) {
                            const pin = this.clientSocket.pin;
                            this.clientSocket.socket.emit('leaveObserver', { pin });
                        }

                        this.router.navigate([Route.MainMenu]);
                    }
                },
                error: () => {
                    return;
                },
            });
    }
    getPlayerQrlAnswer(player: Player): string | null {
        const answer = this.qrlAnswers.find((qrlanswer) => qrlanswer.submitter === player.name);
        return answer ? answer.text || null : null;
    }
    getPlayerQreAnswer(player: Player): number | null {
        const answer = this.qreAnswers.find((qreAnswer) => qreAnswer.submitter === player.name);
        this.slideAnswerForm.setValue(answer ? answer.value : null);

        return answer ? answer.value : null;
    }
    getPlayerQcmAnswer(player: Player): string | null {
        const answer = this.qcmAnswers.find((qcmAnswer) => qcmAnswer.submitter === player.name);
        return answer ? answer.selectedChoices?.join(', ') || null : null;
    }

    private submitStats() {
        this.statsService.updatePlayerStats().subscribe({
            next: () => {
                return;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
            },
        });
    }
}
