import {
    AfterViewChecked,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    HostListener,
    inject,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ButtonState, Route } from '@app/constants/enums';
import { DELAY_BEFORE_INPUT_INACTIVITY, GRADES, PAUSE_MESSAGE, TIME_OUT, UNPAUSE_MESSAGE } from '@app/constants/in-game';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { Button } from '@app/interfaces/button-model';
import { AnswerValidatorService } from '@app/services/answer-validator/answer-validator.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from '@app/services/timer/timer.service';
import { Choice, Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Limit } from '@common/limit';
import { ACTIVE_PLAYERS_TEXT, Answer, FIFTY, HUNDRED, INACTIVE_PLAYERS_TEXT, ZERO } from '@common/lobby';
import { Subscription } from 'rxjs/internal/Subscription';

@Component({
    selector: 'app-button-response',
    templateUrl: './button-response.component.html',
    styleUrls: ['./button-response.component.scss'],
})
export class ButtonResponseComponent implements OnInit, AfterViewChecked, OnDestroy {
    @ViewChild('buttonFocus', { static: false }) buttonFocus: ElementRef;
    @ViewChild('answerInput', { static: false }) answerInput: ElementRef;
    @Output() updateQuestionScore = new EventEmitter<number>();
    grades: number[] = GRADES;
    maxQrlAnswerLength: number = Limit.MaxQrlAnswerLength;
    currentAnswerIndex: number = 0;
    submitted: boolean = false;
    isGamePaused: boolean = false;
    isOrganizer: boolean = this.clientSocket.isOrganizer;
    answerForm: FormControl = this.answerValidator.answerForm;
    playerHasInteracted: boolean = false;
    private hasFocusedOnce: boolean = false;
    private studentGrades: { [studentName: string]: number } = {};
    private initialPlayers = this.clientSocket.players;
    private submittedFromTimer: boolean = false;
    private timerSubscription: Subscription;
    private currentGame: Game = this.gameService.currentGame;
    private router: Router = inject(Router);
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private timer: TimerService = inject(TimerService);
    private changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);

    constructor(
        private gameService: GameHandlingService,
        private answerValidator: AnswerValidatorService,
        private clientSocket: ClientSocketService,
    ) {}

    // Utilisés dans le template
    get pauseMessage(): string {
        return this.isGamePaused ? UNPAUSE_MESSAGE : PAUSE_MESSAGE;
    }

    get isCurrentQuestionQcm(): boolean {
        return this.gameService.isCurrentQuestionQcm();
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
            ? 'Charger les résultats'
            : 'Charger la prochaine question';
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

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const clickedElement = event.target as HTMLElement;
        if (this.buttonFocus && !clickedElement.closest('#chatInput')) this.buttonFocus.nativeElement.focus();
    }

    ngOnInit(): void {
        this.updateButtons();
        this.populateHistogram();
        this.configureBaseSocketFeatures();
    }

    ngOnDestroy(): void {
        if (this.timerSubscription) this.timerSubscription.unsubscribe();
        this.answerValidator.reset();
    }

    ngAfterViewChecked(): void {
        if (!this.hasFocusedOnce) {
            if (this.buttonFocus) this.focusElement(this.buttonFocus);
            else if (this.answerInput) this.focusElement(this.answerInput);
        }
    }
    // Pour le focus de la page sur les boutons
    focusElement(elementRef: ElementRef): void {
        elementRef.nativeElement.focus();
        this.hasFocusedOnce = true;
        this.changeDetector.detectChanges();
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
            this.snackBar.open('Tous les joueurs ont quitté la partie.', '', SNACK_BAR_ERROR_CONFIGURATION);
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
            }
        }
    }

    onButtonClick(button: Button) {
        if (this.answerValidator.isProcessing) return;
        this.markFirstInteraction();
        button.selected = !button.selected;
        const changeValue: number = button.selected ? ButtonState.Selected : ButtonState.Unselected;
        if (this.gameService.gameMode === GameMode.RealGame) {
            const histogramUpdateData = { [button.text]: changeValue };
            this.clientSocket.sendUpdateHistogram(histogramUpdateData);
        }
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
            this.clientSocket.socket.emit('gameEnded');
        } else {
            this.gameService.setCurrentQuestionId(++this.gameService.currentQuestionId);
            if (this.isOrganizer) this.clientSocket.socket.emit('resetPlayersActivityState');
            this.playerHasInteracted = false;
            this.updateButtons();
            this.populateHistogram();
            this.gameService.setCurrentQuestion(this.currentGame.questions[this.gameService.currentQuestionId].text);
            this.updateQuestionScore.emit(this.currentGame.questions[this.gameService.currentQuestionId].points);
            if (this.clientSocket.isOrganizer || this.gameService.gameMode === GameMode.Testing)
                this.timer.startCountdown(this.gameService.getCurrentQuestionDuration());
            this.hasFocusedOnce = false;
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

    populateHistogram(): void {
        if (this.gameService.gameMode === GameMode.RealGame && this.isOrganizer) {
            let initialValue = 0;
            if (this.isCurrentQuestionQcm) this.buttons.forEach((button) => this.clientSocket.sendUpdateHistogram({ [button.text]: initialValue }));
            else {
                this.clientSocket.sendUpdateHistogram({ [ACTIVE_PLAYERS_TEXT]: initialValue++ });
                this.initialPlayers.forEach((player) => {
                    if (player.name !== 'Organisateur') this.clientSocket.sendUpdateHistogram({ [INACTIVE_PLAYERS_TEXT]: initialValue });
                });
            }
        }
    }

    startNextQuestionCountdown(): void {
        this.clientSocket.sendResetHistogram();
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
        return this.answerForm.value.trim().length === 0 && !this.buttons.some((button) => button.selected === true);
    }

    evaluateAnswer(grade: number): void {
        this.currentEvaluatedAnswer.grade = grade;
        const studentName = this.currentEvaluatedAnswer.submitter;
        if (studentName !== undefined) this.studentGrades[studentName] = this.currentEvaluatedAnswer.grade * HUNDRED;
        this.updateHistogram();
        if (this.currentAnswerIndex !== this.answerValidator.qrlAnswers.length - 1) ++this.currentAnswerIndex;
    }

    updateHistogram(): void {
        let count0 = 0;
        let count50 = 0;
        let count100 = 0;
        Object.values(this.studentGrades).forEach((grade) => {
            switch (grade) {
                case ZERO:
                    count0++;
                    break;
                case FIFTY:
                    count50++;
                    break;
                case HUNDRED:
                    count100++;
                    break;
            }
        });
        const histogramUpdateData: { [key: string]: number } = {};
        histogramUpdateData['0%'] = count0;
        histogramUpdateData['50%'] = count50;
        histogramUpdateData['100%'] = count100;
        this.clientSocket.sendQrlUpdateHistogram(histogramUpdateData);
    }

    getPreviousAnswer(): void {
        --this.currentAnswerIndex;
    }

    endEvaluationPhase(): void {
        this.clientSocket.socket.emit('evaluationPhaseCompleted', this.answerValidator.qrlAnswers);
    }

    submit(): void {
        this.submitted = true;
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
}
