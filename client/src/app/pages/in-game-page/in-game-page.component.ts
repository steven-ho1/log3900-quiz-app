import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { PANIC_SOUNDS } from '@app/constants/audio';
import { Route } from '@app/constants/enums';
import { AnswerValidatorService } from '@app/services/answer-validator/answer-validator.service';
import { AudioService } from '@app/services/audio/audio.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { TimerService } from '@app/services/timer/timer.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { ACTIVE_PLAYERS_TEXT, INACTIVE_PLAYERS_TEXT, indexFind } from '@common/lobby';

import { Subscription } from 'rxjs/internal/Subscription';

@Component({
    selector: 'app-in-game-page',
    templateUrl: './in-game-page.component.html',
    styleUrls: ['./in-game-page.component.scss'],
})
export class InGamePageComponent implements OnInit, OnDestroy {
    currentGame: Game;
    currentQuestion: string = '';
    currentQuestionScore: number;
    score: number;
    showResults: boolean = false;
    histogramData: { [key: string]: number };
    correctAnswers: string[];
    playerName = this.clientSocket.playerName;
    private histogramQrlSubscription: Subscription;
    private subscriptionScore: Subscription;
    private questionSubscription: Subscription;
    private histogramSubscription: Subscription;
    private routeController: RouteControllerService = inject(RouteControllerService);
    private timer: TimerService = inject(TimerService);
    private dialog: MatDialog = inject(MatDialog);
    private answerValidator: AnswerValidatorService = inject(AnswerValidatorService);
    private audio: AudioService = inject(AudioService);

    constructor(
        private gameService: GameHandlingService,
        private clientSocket: ClientSocketService,
        private router: Router,
    ) {}

    get isOrganizer() {
        return this.clientSocket.isOrganizer;
    }

    get isQuestionTransition(): boolean {
        return this.timer.isQuestionTransition;
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
        this.currentGame = this.gameService.currentGame;
        this.gameService.setCurrentQuestionId(0);
        this.currentQuestion = this.currentGame.questions[this.gameService.currentQuestionId].text;
        this.currentQuestionScore = this.currentGame.questions[this.gameService.currentQuestionId].points;

        this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
        this.gameService.setScore(0);

        this.questionSubscription = this.gameService.currentQuestion$.subscribe(() => {
            this.currentQuestion = this.currentGame.questions[this.gameService.currentQuestionId].text;
        });

        this.subscriptionScore = this.gameService.score$.subscribe((updatedScore) => {
            this.score = updatedScore;
            this.clientSocket.socket.emit('submitScore', updatedScore);
        });

        this.histogramSubscription = this.clientSocket.listenUpdateHistogram().subscribe((data) => {
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
        });

        this.histogramQrlSubscription = this.clientSocket.listenQrlUpdateHistogram().subscribe((data) => {
            this.histogramData = data;
            this.gameService.updateHistogramDataForQuestion(this.gameService.currentQuestionId, data);
        });

        this.clientSocket.socket.on('showResults', () => {
            this.showResults = true;
        });

        this.clientSocket.socket.on('panicMode', () => {
            this.timer.isPanicModeEnabled = true;
            this.audio.play(PANIC_SOUNDS);
        });
    }

    ngOnDestroy(): void {
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
    }

    onUpdateQuestionScore(score: number) {
        this.currentQuestionScore = score;
    }

    abandonGame(): void {
        this.dialog
            .open(ConfirmationPopupComponent, {
                backdropClass: 'backdropBackground',
                disableClose: true,
                data: { title: 'Abandon de partie', description: 'Voulez-vous vraiment abandonner la partie?', primaryAction: 'Abandonner' },
            })
            .afterClosed()
            .subscribe((isLeaving: boolean) => {
                if (isLeaving) {
                    if (this.gameService.gameMode === GameMode.Testing) {
                        this.router.navigate([Route.GameCreation]);
                        return;
                    }
                    this.router.navigate([Route.MainMenu]);
                }
            });
    }
}
