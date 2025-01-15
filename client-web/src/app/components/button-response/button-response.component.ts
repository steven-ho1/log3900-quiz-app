/* eslint-disable no-console */
/* eslint-disable max-lines */
import { Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Button } from '@app/constants/button-model';
import { Route } from '@app/constants/enums';
import { DELAY_BEFORE_INPUT_INACTIVITY, GRADES, TIME_OUT } from '@app/constants/in-game';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AnswerValidatorService } from '@app/services/answer-validator/answer-validator.service';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from '@app/services/timer/timer.service';
import { Choice, Game, Question, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Limit } from '@common/limit';
import { Answer, HUNDRED, QcmAnswer } from '@common/lobby';
import { Challenge } from '@common/stats';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import * as lodash from 'lodash-es';
import { Subscription } from 'rxjs/internal/Subscription';

@Component({
    selector: 'app-button-response',
    templateUrl: './button-response.component.html',
    styleUrls: ['./button-response.component.scss'],
})
export class ButtonResponseComponent implements OnInit, OnDestroy {
    @ViewChild('buttonFocus', { static: false }) buttonFocus: ElementRef;
    @ViewChild('answerInput', { static: false }) answerInput: ElementRef;
    @Input() isObserver: boolean = false;
    @Output() updateQuestionScore = new EventEmitter<number>();
    protected hintCost: number = 0;
    protected grades: number[] = GRADES;
    protected maxQrlAnswerLength: number = Limit.MaxQrlAnswerLength;
    protected currentAnswerIndex: number = 0;
    protected submitted: boolean = false;
    protected isGamePaused: boolean = false;
    protected isOrganizer: boolean = this.clientSocket.isOrganizer;
    protected answerForm: FormControl = this.answerValidator.answerForm;
    protected slideAnswerForm: FormControl = this.answerValidator.slideAnswerForm;
    protected playerHasInteracted: boolean = false;
    protected sliderValue: number = 0;
    protected lowerBound: number | undefined;
    protected upperBound: number | undefined;
    protected hintId: number | null = null;
    protected canPurchaseHint: boolean = true;
    protected playerName = this.clientSocket.playerName;
    protected isRealGame: boolean;
    protected challenge: Challenge;
    protected currentLanguage: string;

    private studentGrades: { [studentName: string]: number } = {};
    private submittedFromTimer: boolean = false;
    private timerSubscription: Subscription;
    private currentGame: Game = this.gameService.currentGame;
    private router: Router = inject(Router);
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private timer: TimerService = inject(TimerService);
    private authService: AuthService = inject(AuthService);
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private gameService: GameHandlingService,
        private answerValidator: AnswerValidatorService,
        private clientSocket: ClientSocketService,
    ) {
        this.isRealGame = this.gameService.gameMode === GameMode.RealGame;
        this.hintCost = this.gameService.totalVictoryPrize / 2;
        this.challenge = this.gameService.challenge as Challenge;

        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    // Utilisés dans le template
    get pauseMessage(): string {
        return this.isGamePaused
            ? this.currentLanguage === Language.French
                ? 'Reprendre la partie'
                : 'Unpause game'
            : this.currentLanguage === Language.French
            ? 'Mettre la partie en pause'
            : 'Pause game';
    }

    get wallet() {
        return this.authService.user?.wallet ?? 0;
    }

    get isCurrentQuestionQcm(): boolean {
        return this.gameService.isCurrentQuestionQcm();
    }
    get isCurrentQuestionQre(): boolean {
        return this.gameService.isCurrentQuestionQre();
    }

    get isPanicModeEnabled(): boolean {
        return this.timer.isPanicModeEnabled;
    }

    get isPanicModeAvailable(): boolean {
        return this.timer.count <= (this.isCurrentQuestionQcm ? Limit.QcmRequiredPanicCount : Limit.QrlRequiredPanicCount);
    }

    get remainingCountForPanic(): number {
        return this.timer.count - (this.isCurrentQuestionQcm ? Limit.QcmRequiredPanicCount : Limit.QrlRequiredPanicCount);
    }

    get isQuestionTransition(): boolean {
        return this.timer.isQuestionTransition;
    }

    get currentEvaluatedAnswer(): Answer {
        return this.answerValidator.qrlAnswers[this.currentAnswerIndex];
    }

    get buttons(): Button[] {
        return this.answerValidator.buttons;
    }

    get qrlAnswers(): Answer[] {
        return this.answerValidator.qrlAnswers;
    }

    get buttonLoadingMessage(): string {
        return this.gameService.currentQuestionId === this.gameService.currentGame.questions.length - 1
            ? this.currentLanguage === Language.French
                ? 'Charger les résultats'
                : 'Load results'
            : this.currentLanguage === Language.French
            ? 'Charger la prochaine question'
            : 'Load next question';
    }

    get isEvaluationPhase(): boolean {
        return this.answerValidator.isEvaluationPhase;
    }

    get canLoadNextQuestion(): boolean {
        return this.answerValidator.canLoadNextQuestion;
    }

    get hasQuestionEnded(): boolean {
        return this.answerValidator.hasQuestionEnded;
    }

    ngOnInit(): void {
        this.updateButtons();
        this.configureBaseSocketFeatures();
    }

    ngOnDestroy(): void {
        if (this.timerSubscription) this.timerSubscription.unsubscribe();
        this.answerValidator.reset();
        this.clientSocket.socket.off('countdownEnd');
        this.clientSocket.socket.off('noPlayers');
    }

    configureBaseSocketFeatures(): void {
        this.clientSocket.socket.on('countdownEnd', () => {
            if (this.isQuestionTransition) {
                this.loadNextQuestion();
                return;
            }
            this.onTimerEnded();
        });
        this.clientSocket.socket.on('noPlayers', () => {
            this.snackBar.open(
                this.currentLanguage === Language.French ? 'Tous les joueurs ont quitté la partie.' : 'All players have left the game.',
                '',
                SNACK_BAR_ERROR_CONFIGURATION,
            );
            this.timer.stopCountdown();
            this.answerValidator.isEvaluationPhase = false;
            this.answerValidator.hasQuestionEnded = true;
            this.answerValidator.canLoadNextQuestion = false;
        });
    }

    onTimerEnded(): void {
        this.submittedFromTimer = true;
        if (!this.clientSocket.isOrganizer) this.submit();
    }

    updateButtons(): void {
        this.gameService.startChallengeTimer();
        if (this.isCurrentQuestionQcm) {
            const questionOfInterest = this.currentGame.questions[this.gameService.currentQuestionId];
            if (questionOfInterest.choices) {
                this.answerValidator.buttons = [];
                questionOfInterest.choices.forEach((choice: Choice, buttonIndex: number) => {
                    this.buttons.push({
                        color: 'white',
                        selected: false,
                        text: choice.text,
                        isCorrect: choice.isCorrect,
                        id: buttonIndex + 1,
                    });
                });

                if (this.isOrganizer) {
                    this.buttons.forEach((button) => {
                        if (button.isCorrect) button.showCorrectButtons = true;
                        if (!button.isCorrect) {
                            button.showWrongButtons = true;
                        }
                    });
                }
            }
        }
        if (this.isCurrentQuestionQre) {
            const questionOfInterest: Question = this.currentGame.questions[this.gameService.currentQuestionId];
            if (questionOfInterest.correctSlideAnswer !== undefined) {
                this.lowerBound = questionOfInterest.lowerBound;
                this.upperBound = questionOfInterest.upperBound;
                this.slideAnswerForm.setValue(this.lowerBound);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSliderChange(event: any): void {
        this.slideAnswerForm.setValue(event.value);
    }

    onButtonClick(button: Button) {
        if (this.answerValidator.isProcessing) return;
        this.markFirstInteraction();
        button.selected = !button.selected;
    }

    playerEntries(event: KeyboardEvent): void {
        if (this.answerValidator.isProcessing) return;
        if (event.key === 'Enter' && !this.isAnswerEmpty()) {
            event.preventDefault();
            this.submit();
        } else {
            if (parseInt(event.key, 10) >= 1 && parseInt(event.key, 10) <= this.buttons.length) {
                const button = this.buttons[parseInt(event.key, 10) - 1];
                this.onButtonClick(button);
            }
        }
    }

    updateGameQuestions(): void {
        if (this.gameService.currentQuestionId === this.currentGame.questions.length - 1) {
            if (this.gameService.gameMode === GameMode.Testing) {
                this.router.navigate([Route.GameCreation]);
                return;
            }
            if (this.isOrganizer) this.clientSocket.socket.emit('gameEnded');
        } else {
            this.gameService.setCurrentQuestionId(++this.gameService.currentQuestionId);
            this.clientSocket.socket.emit('updateCurrentQuestionNumber', {
                pin: this.clientSocket.pin,
                currentQuestionNumber: this.gameService.currentQuestionId,
            });
            if (this.isOrganizer) this.clientSocket.socket.emit('resetPlayersActivityState');
            this.playerHasInteracted = false;
            this.updateButtons();
            this.hintId = null;
            this.canPurchaseHint = true;
            this.gameService.setCurrentQuestion(this.currentGame.questions[this.gameService.currentQuestionId].text);
            this.updateQuestionScore.emit(this.currentGame.questions[this.gameService.currentQuestionId].points);
            if (this.clientSocket.isOrganizer || this.gameService.gameMode === GameMode.Testing)
                this.timer.startCountdown(this.gameService.getCurrentQuestionDuration());
        }
    }

    loadNextQuestion(): void {
        this.answerValidator.prepareNextQuestion();
        this.submitted = false;
        this.submittedFromTimer = false;
        this.timer.isQuestionTransition = false;
        this.isGamePaused = false;
        this.currentAnswerIndex = 0;
        this.updateGameQuestions();
    }
    startNextQuestionCountdown(): void {
        this.answerValidator.canLoadNextQuestion = false;
        this.isGamePaused = false;
        this.timer.startCountdown(TIME_OUT, { isQuestionTransition: true });
    }

    pause(): void {
        if (this.isGamePaused) {
            if (this.timer.isQuestionTransition) this.timer.startCountdown(this.timer.transitionCount);
            else this.timer.startCountdown(this.timer.count, { isPanicModeEnabled: this.isPanicModeEnabled });
            this.isGamePaused = !this.isGamePaused;
            return;
        }
        this.timer.stopCountdown();
        this.isGamePaused = !this.isGamePaused;
    }

    panic(): void {
        this.clientSocket.socket.emit('enablePanicMode');
        this.timer.stopCountdown();
        this.timer.startCountdown(this.timer.count, { isPanicModeEnabled: true });
    }

    isAnswerEmpty(): boolean {
        return this.answerForm.value.trim().length === 0 && !this.buttons.some((button) => button.selected === true) && !this.isCurrentQuestionQre;
    }

    evaluateAnswer(grade: number): void {
        this.currentEvaluatedAnswer.grade = grade;
        const studentName = this.currentEvaluatedAnswer.submitter;
        if (studentName !== undefined) this.studentGrades[studentName] = this.currentEvaluatedAnswer.grade * HUNDRED;
        if (this.currentAnswerIndex !== this.answerValidator.qrlAnswers.length - 1) ++this.currentAnswerIndex;
    }

    getPreviousAnswer(): void {
        --this.currentAnswerIndex;
    }

    endEvaluationPhase(): void {
        this.clientSocket.socket.emit('evaluationPhaseCompleted', this.answerValidator.qrlAnswers);
    }

    submit(): void {
        this.gameService.stopChallengeTimer();
        this.submitted = true;
        if (this.isCurrentQuestionQcm) {
            const selectedButtons = this.buttons.filter((button) => button.selected);
            const selectedChoices = selectedButtons.map((button) => button.text);

            const answer: QcmAnswer = {
                submitter: this.clientSocket.playerName,
                questionType: QuestionType.QCM,
                selectedChoices,
            };

            this.clientSocket.socket.emit('qcmAnswerSubmitted', answer);
            this.answerValidator.submitAnswer(this.submittedFromTimer);
        }
        this.answerValidator.submitAnswer(this.submittedFromTimer);
    }

    markFirstInteraction() {
        if (!this.playerHasInteracted) {
            this.clientSocket.socket.emit('socketInteracted');
            this.playerHasInteracted = true;
        }
    }

    markInputActivity(): void {
        if (this.gameService.gameMode === GameMode.RealGame) {
            this.clientSocket.socket.emit('markInputActivity');
            this.timer.startCountdown(DELAY_BEFORE_INPUT_INACTIVITY, { isInputInactivityCountdown: true });
            this.markFirstInteraction();
        }
    }

    purchaseHint() {
        this.gameService.purchaseHint().subscribe({
            next: (user: User) => {
                const wrongAnswerButtons: Button[] = this.buttons.filter((button) => !button.isCorrect);
                console.log(wrongAnswerButtons);
                this.hintId = lodash.sample(wrongAnswerButtons)?.id as number;
                this.canPurchaseHint = false;
                this.authService.user = user;
                this.snackBar.open(
                    this.currentLanguage === Language.French ? 'Indice acheté!' : 'Hint purchased!',
                    '',
                    SNACK_BAR_NORMAL_CONFIGURATION,
                );
            },
            error: () => {
                // Pas la peine de gérer les erreurs...
                return;
            },
        });
    }
}
