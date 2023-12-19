/* eslint-disable max-lines */
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { ButtonResponseComponent } from '@app/components/button-response/button-response.component';
import { Route } from '@app/constants/enums';
import { DELAY_BEFORE_INPUT_INACTIVITY, PAUSE_MESSAGE, TIME_OUT, UNPAUSE_MESSAGE } from '@app/constants/in-game';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { Button } from '@app/interfaces/button-model';
import { AnswerValidatorService } from '@app/services/answer-validator/answer-validator.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from '@app/services/timer/timer.service';
import { Game, Question, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Limit } from '@common/limit';
import { Answer, PlayerColor } from '@common/lobby';

describe('ButtonResponseComponent', () => {
    let mockButtons: Button[];
    let mockQuestions: Question[];
    let qrlAnswers: Answer[];
    let mockGame: Game;
    let component: ButtonResponseComponent;
    let fixture: ComponentFixture<ButtonResponseComponent>;
    let routerMock: jasmine.SpyObj<Router>;
    let timerMock: jasmine.SpyObj<TimerService>;
    let changeDetectorMock: jasmine.SpyObj<ChangeDetectorRef>;
    let answerValidatorMock: jasmine.SpyObj<AnswerValidatorService>;
    let gameHandlingServiceMock: jasmine.SpyObj<GameHandlingService>;
    let snackBarMock: jasmine.SpyObj<MatSnackBar>;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let socketMock: SocketMock;

    beforeEach(() => {
        mockButtons = [
            {
                color: 'white',
                selected: false,
                text: 'Test1',
                isCorrect: true,
                id: 1,
            },
            {
                color: 'white',
                selected: false,
                text: 'Test2',
                isCorrect: false,
                id: 2,
            },
            {
                color: 'white',
                selected: true,
                text: 'Test3',
                isCorrect: true,
                id: 3,
            },
            {
                color: 'white',
                selected: true,
                text: 'Test4',
                isCorrect: false,
                id: 4,
            },
        ];

        mockQuestions = [
            {
                text: 'What is the capital of France?',
                points: 10,
                type: QuestionType.QCM,
                choices: [
                    { text: 'Paris', isCorrect: true },
                    { text: 'London', isCorrect: false },
                    { text: 'Berlin', isCorrect: false },
                    { text: 'Madrid', isCorrect: false },
                ],
            },
            {
                text: 'Question 2',
                points: 10,
                type: QuestionType.QRL,
            },
        ];

        mockGame = {
            id: '1',
            title: 'Game 1',
            description: 'Test ',
            duration: 5,
            lastModification: '2018-11-13',
            questions: mockQuestions,
        };

        qrlAnswers = [
            { submitter: 'player1', questionType: QuestionType.QCM, isCorrect: true, grade: 1 },
            { submitter: 'player2', questionType: QuestionType.QRL, text: 'Meow', grade: 0.5 },
        ];

        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        answerValidatorMock = jasmine.createSpyObj('AnswerValidatorService', ['reset', 'processAnswer', 'prepareNextQuestion', 'submitAnswer']);
        timerMock = jasmine.createSpyObj('Timer', ['reset', 'startCountdown', 'stopCountdown']);
        gameHandlingServiceMock = jasmine.createSpyObj('GameHandlingService', [
            'setCurrentQuestionId',
            'setCurrentQuestion',
            'incrementScore',
            'getCurrentQuestionDuration',
            'isCurrentQuestionQcm',
        ]);
        changeDetectorMock = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);
        snackBarMock = jasmine.createSpyObj('MatSnackBar', ['open']);
        clientSocketServiceMock = new ClientSocketServiceMock();
        gameHandlingServiceMock.currentGame = mockGame;
        gameHandlingServiceMock.currentQuestionId = 0;
        TestBed.configureTestingModule({
            declarations: [ButtonResponseComponent],
            imports: [HttpClientTestingModule, MatSnackBarModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule, BrowserAnimationsModule],
            providers: [
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                { provide: Router, useValue: routerMock },
                { provide: TimerService, useValue: timerMock },
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
                { provide: MatSnackBar, useValue: snackBarMock },
                { provide: AnswerValidatorService, useValue: answerValidatorMock },
                { provide: ChangeDetectorRef, useValue: changeDetectorMock },
            ],
        });
        answerValidatorMock.answerForm = new FormControl('');
        answerValidatorMock.buttons = mockButtons;
        fixture = TestBed.createComponent(ButtonResponseComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        socketMock.clientUniqueEvents.clear();
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        component['answerValidator'].qrlAnswers = [
            { submitter: 'player1', questionType: QuestionType.QRL, grade: 0 },
            { submitter: 'player2', questionType: QuestionType.QRL, grade: 0 },
        ];
        component['studentGrades'] = {
            player1: 0,
            player2: 0,
        };
        component['currentAnswerIndex'] = 0;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('pauseMessage getter should return unpause message if game is paused', () => {
        component.isGamePaused = true;
        expect(component.pauseMessage).toEqual(UNPAUSE_MESSAGE);
    });

    it('pauseMessage getter should return pause message if game is not paused', () => {
        component.isGamePaused = false;
        expect(component.pauseMessage).toEqual(PAUSE_MESSAGE);
    });

    it('isCurrentQuestionQcm getter should call and return value of isCurrentQuestionQcm method of GameHandlingService', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        expect(component.isCurrentQuestionQcm).toBeTrue();
        expect(gameHandlingServiceMock.isCurrentQuestionQcm).toHaveBeenCalled();

        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(false);
        expect(component.isCurrentQuestionQcm).toBeFalse();
    });

    it('isPanicModeEnabled getter should get isPanicModeEnabled from the TimerService', () => {
        timerMock.isPanicModeEnabled = true;
        expect(component.isPanicModeEnabled).toBeTrue();

        timerMock.isPanicModeEnabled = false;
        expect(component.isPanicModeEnabled).toBeFalse();
    });

    it('isPanicModeAvailable getter should return true if the current count is lower or equal than the required count for panic mode', () => {
        const count = 10;
        timerMock.count = count;
        spyOnProperty(component, 'isCurrentQuestionQcm').and.returnValue(true);
        expect(component.isPanicModeAvailable).toBeTrue();
    });

    it('isPanicModeAvailable getter should return false if the current count is greater than the required count for panic mode', () => {
        const count = 30;
        timerMock.count = count;
        gameHandlingServiceMock.currentQuestionId = 0;
        expect(component.isPanicModeAvailable).toBeFalse();

        gameHandlingServiceMock.currentQuestionId = 1;
        expect(component.isPanicModeAvailable).toBeFalse();
    });

    it('remainingCountForPanic should return remaining count for panic mode to be available for a QCM', () => {
        const count = 5;
        spyOnProperty(component, 'isCurrentQuestionQcm').and.returnValue(true);
        component['currentGame'] = mockGame;
        timerMock.count = count;
        gameHandlingServiceMock.currentQuestionId = 0;
        expect(component.remainingCountForPanic).toEqual(count - Limit.QcmRequiredPanicCount);
    });

    it('remainingCountForPanic should return remaining count for panic mode to be available for a QRL', () => {
        const count = 5;
        component['currentGame'] = mockGame;
        timerMock.count = count;
        spyOnProperty(component, 'isCurrentQuestionQcm').and.returnValue(false);
        expect(component.remainingCountForPanic).toEqual(count - Limit.QrlRequiredPanicCount);
    });

    it('isQuestionTransition getter should get isQuestionTransition from the TimerService', () => {
        timerMock.isQuestionTransition = true;
        expect(component.isQuestionTransition).toBeTrue();

        timerMock.isQuestionTransition = false;
        expect(component.isQuestionTransition).toBeFalse();
    });

    it("currentEvaluatedAnswer getter should current evaluated answer from qrlAnswers depending on currentAnswerIndex's value", () => {
        answerValidatorMock.qrlAnswers = qrlAnswers;
        component.currentAnswerIndex = 1;
        expect(component.currentEvaluatedAnswer).toEqual(qrlAnswers[component.currentAnswerIndex]);
    });

    it('should call updateButtons, populateHistogram and configureBaseSocketFeatures on component initialization', () => {
        spyOn(component, 'updateButtons');
        spyOn(component, 'populateHistogram');
        spyOn(component, 'configureBaseSocketFeatures');
        component.ngOnInit();
        expect(component.updateButtons).toHaveBeenCalled();
        expect(component.populateHistogram).toHaveBeenCalled();
        expect(component.configureBaseSocketFeatures).toHaveBeenCalled();
    });

    it('should unsubscribe from timerSubscription on component destruction', () => {
        component['timerSubscription'] = jasmine.createSpyObj('Subscription', ['unsubscribe']);
        component.ngOnDestroy();
        const unsubscribeTimerSubscription = component['timerSubscription'].unsubscribe;
        expect(unsubscribeTimerSubscription).toHaveBeenCalled();
    });

    it('should reset AnswerValidatorService on component destruction', () => {
        component.ngOnDestroy();
        expect(answerValidatorMock.reset).toHaveBeenCalled();
    });

    it('should handle countdownEnd event by loading the next question if isQuestionTransition from TimerService is true', () => {
        timerMock.isQuestionTransition = true;
        spyOn(component, 'loadNextQuestion');
        socketMock.simulateServerEmit('countdownEnd');
        expect(component.loadNextQuestion).toHaveBeenCalled();
    });

    it('should handle countdownEnd event by calling onTimerEnded if isQuestionTransition from TimerService is false', () => {
        timerMock.isQuestionTransition = false;
        spyOn(component, 'onTimerEnded');
        socketMock.simulateServerEmit('countdownEnd');
        expect(component.onTimerEnded).toHaveBeenCalled();
    });

    it('should handle noPlayers event by opening a snack bar, stopping the timer and setting\
        isEvaluationPhase, hasQuestionEnded and canLoadNextQuestion to false', () => {
        answerValidatorMock.isEvaluationPhase = false;
        answerValidatorMock.hasQuestionEnded = false;
        answerValidatorMock.canLoadNextQuestion = true;
        socketMock.simulateServerEmit('noPlayers');
        expect(snackBarMock.open).toHaveBeenCalledWith('Tous les joueurs ont quitté la partie.', '', SNACK_BAR_ERROR_CONFIGURATION);
        expect(timerMock.stopCountdown).toHaveBeenCalled();
        expect(component.isEvaluationPhase).toBeFalse();
        expect(component.hasQuestionEnded).toBeTrue();
        expect(component.canLoadNextQuestion).toBeFalse();
    });

    it('onTimerEnded should set submittedFromTimer to true and call submit if the user is a player', () => {
        component['submittedFromTimer'] = false;
        spyOn(component, 'submit');
        component.onTimerEnded();
        expect(component['submittedFromTimer']).toBeTrue();
        expect(component.submit).toHaveBeenCalled();
    });

    it('updateButtons should update buttons with correct game and possible texts', () => {
        const MOCK_BUTTONS_LENGTH = 4;
        gameHandlingServiceMock.currentQuestionId = 0;
        spyOnProperty(component, 'isCurrentQuestionQcm').and.returnValue(true);
        component.updateButtons();
        expect(component.buttons.length).toBe(MOCK_BUTTONS_LENGTH);
        expect(component.buttons[0].text).toBe('Paris');
        expect(component.buttons[0].isCorrect).toBe(true);
        component.updateGameQuestions();
        expect(component.updateButtons()).toBeUndefined();
    });

    it('onButtonClick should toggle button.selected', () => {
        answerValidatorMock.isProcessing = false;
        const testButton = mockButtons[1];
        component.onButtonClick(testButton);
        expect(testButton.selected).toBeTrue();
        component.onButtonClick(testButton);
        expect(testButton.selected).toBeFalse();
    });

    it('onButtonClick should do nothing if isProcessing is True', () => {
        const testButton = mockButtons[0];
        answerValidatorMock.isProcessing = true;
        testButton.selected = false;
        component.onButtonClick(testButton);
        expect(testButton.selected).toBeFalse();
    });

    it('onButtonClick should call sendUpdateHistogram if game mode is RealGame', () => {
        const testButton = mockButtons[0];
        spyOn(clientSocketServiceMock, 'sendUpdateHistogram');
        answerValidatorMock.isProcessing = false;
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        component.onButtonClick(testButton);
        expect(clientSocketServiceMock.sendUpdateHistogram).toHaveBeenCalled();
    });

    it('playerEntries should call onButtonClick', () => {
        spyOnProperty(component, 'buttons').and.returnValue([mockButtons[0]]);
        const event = new KeyboardEvent('keydown', { key: '1' });
        const onButtonClickSpy = spyOn(component, 'onButtonClick');
        component.playerEntries(event);
        expect(onButtonClickSpy).toHaveBeenCalled();
    });

    it('playerEntries should not work if isProcessing = true', () => {
        const event = new KeyboardEvent('keydown', { key: '1' });
        answerValidatorMock.isProcessing = true;
        const onButtonClickSpy = spyOn(component, 'onButtonClick');
        component.playerEntries(event);
        expect(onButtonClickSpy).not.toHaveBeenCalled();
    });

    it('playerEntries should work with Enter when isProcessing is False', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        answerValidatorMock.isProcessing = false;
        const onButtonClickSpy = spyOn(component, 'onButtonClick');
        const verifyResponsesAndCallUpdateSpy = spyOn(component, 'submit');
        component.playerEntries(event);
        expect(onButtonClickSpy).not.toHaveBeenCalled();
        expect(verifyResponsesAndCallUpdateSpy).toHaveBeenCalled();
    });

    it('updateGameQuestions should navigate to game creation page if currentQuestionId equals last question and game mode is Testing', () => {
        gameHandlingServiceMock.currentQuestionId = component['currentGame'].questions.length - 1;
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        component.updateGameQuestions();
        expect(routerMock.navigate).toHaveBeenCalledWith([Route.GameCreation]);
    });

    it('updateGameQuestions should emit gameEnded event if currentQuestionId equals last question and game mode is RealGame', () => {
        gameHandlingServiceMock.currentQuestionId = component['currentGame'].questions.length - 1;
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        component.updateGameQuestions();
        expect(socketMock.emit).toHaveBeenCalledWith('gameEnded');
    });

    it('updateGameQuestions should set the current question to the next one, update the buttons if there is another question', () => {
        gameHandlingServiceMock.currentQuestionId = component['currentGame'].questions.length - 2;
        spyOn(component, 'updateButtons');
        spyOn(component.updateQuestionScore, 'emit');
        component.updateGameQuestions();
        expect(gameHandlingServiceMock.setCurrentQuestionId).toHaveBeenCalled();
        expect(component.updateButtons).toHaveBeenCalled();
        expect(component.updateQuestionScore.emit).toHaveBeenCalled();
        expect(gameHandlingServiceMock.setCurrentQuestion).toHaveBeenCalled();
    });

    it('updateGameQuestions should start countdown if there is another question and the player is the organizer', () => {
        const currentQuestionDuration = 10;
        gameHandlingServiceMock.currentQuestionId = component['currentGame'].questions.length - 2;
        clientSocketServiceMock.isOrganizer = true;
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        gameHandlingServiceMock.getCurrentQuestionDuration.and.returnValue(currentQuestionDuration);
        component.updateGameQuestions();
        expect(gameHandlingServiceMock.getCurrentQuestionDuration).toHaveBeenCalled();
        expect(timerMock.startCountdown).toHaveBeenCalledWith(currentQuestionDuration);
    });

    it('updateGameQuestions should start countdown if there is another question and the player is a tester', () => {
        const currentQuestionDuration = 10;
        gameHandlingServiceMock.currentQuestionId = component['currentGame'].questions.length - 2;
        clientSocketServiceMock.isOrganizer = false;
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        gameHandlingServiceMock.getCurrentQuestionDuration.and.returnValue(currentQuestionDuration);
        component.updateGameQuestions();
        expect(gameHandlingServiceMock.getCurrentQuestionDuration).toHaveBeenCalled();
        expect(timerMock.startCountdown).toHaveBeenCalledWith(currentQuestionDuration);
    });

    it('loadNextQuestion should call prepareNextQuestion, updateGameQuestions and reset every member', () => {
        spyOn(component, 'updateGameQuestions');
        component.submitted = true;
        component['submittedFromTimer'] = true;
        timerMock.isQuestionTransition = true;
        component.isGamePaused = true;
        component.loadNextQuestion();
        expect(answerValidatorMock.prepareNextQuestion).toHaveBeenCalled();
        expect(component.submitted).toBeFalse();
        expect(component['submittedFromTimer']).toBeFalse();
        expect(timerMock.isQuestionTransition).toBeFalse();
        expect(component.isGamePaused).toBeFalse();
        expect(component.currentAnswerIndex).toEqual(0);
        expect(component.updateGameQuestions).toHaveBeenCalled();
    });
    it('startNextQuestionCountDown should reset histogram, start countdown and set canLoadNextQuestion and isGamePaused to false', () => {
        spyOn(clientSocketServiceMock, 'sendResetHistogram');
        answerValidatorMock.canLoadNextQuestion = true;
        component.isGamePaused = true;
        component.startNextQuestionCountdown();
        expect(clientSocketServiceMock.sendResetHistogram).toHaveBeenCalled();
        expect(component.canLoadNextQuestion).toBeFalse();
        expect(component.isGamePaused).toBeFalse();
        expect(timerMock.startCountdown).toHaveBeenCalledWith(TIME_OUT, { isQuestionTransition: true });
    });

    it('pause should restart transition countdown if game was paused during a question transition', () => {
        const transitionCount = 20;
        component.isGamePaused = true;
        timerMock.isQuestionTransition = true;
        timerMock.transitionCount = transitionCount;
        component.pause();
        expect(timerMock.startCountdown).toHaveBeenCalledWith(transitionCount);
        expect(component.isGamePaused).toBeFalse();
    });

    it('pause should restart countdown if game was paused during an ongoing question', () => {
        const count = 10;
        timerMock.isPanicModeEnabled = true;
        component.isGamePaused = true;
        timerMock.isQuestionTransition = false;
        timerMock.count = count;
        component.pause();
        expect(timerMock.startCountdown).toHaveBeenCalledWith(count, { isPanicModeEnabled: true });
        expect(component.isGamePaused).toBeFalse();
    });

    it('pause should stop countdown if game was not paused', () => {
        component.isGamePaused = false;
        component.pause();
        expect(timerMock.stopCountdown).toHaveBeenCalled();
        expect(component.isGamePaused).toBeTrue();
    });

    it('panic should emit enablePanicMode event and start countdown with configuration isPanicModeEnabled to true', () => {
        const currentCount = 10;
        timerMock.count = currentCount;
        component.panic();
        expect(socketMock.emit).toHaveBeenCalledWith('enablePanicMode');
        expect(timerMock.stopCountdown).toHaveBeenCalled();
        expect(timerMock.startCountdown).toHaveBeenCalledWith(currentCount, { isPanicModeEnabled: true });
    });

    it('getPreviousAnswer should decrement currentAnswerIndex', () => {
        component.currentAnswerIndex = 1;
        component.getPreviousAnswer();
        expect(component.currentAnswerIndex).toEqual(0);
    });

    it('should return qrlAnswers from AnswerValidatorService', () => {
        const mockQrlAnswers: Answer[] = [
            {
                submitter: 'Alice',
                questionType: QuestionType.QRL,
                isCorrect: true,
                text: 'Answer 1',
                grade: 0.8,
            },
        ];
        answerValidatorMock.qrlAnswers = mockQrlAnswers;
        expect(component.qrlAnswers).toEqual(mockQrlAnswers);
    });

    it('should return "Charger les résultats" if it is the last question', () => {
        gameHandlingServiceMock.currentQuestionId = mockGame.questions.length - 1;
        expect(component.buttonLoadingMessage).toEqual('Charger les résultats');
    });

    it('should not return "Charger les résultats" if it isnt the last question', () => {
        gameHandlingServiceMock.currentQuestionId = mockGame.questions.length - 2;
        expect(component.buttonLoadingMessage).toEqual('Charger la prochaine question');
    });

    it('should call focus on buttonFocus when clicking outside #chatInput', () => {
        component.buttonFocus = {
            nativeElement: jasmine.createSpyObj('nativeElement', ['focus']),
        };
        const mockDiv = document.createElement('div');
        const mockEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        Object.defineProperty(mockEvent, 'target', { writable: true, value: mockDiv });
        component.onDocumentClick(mockEvent);
        expect(component.buttonFocus.nativeElement.focus).toHaveBeenCalled();
    });

    it('should populate histogram events for QCM question but not sendUpdateHistogram  ', () => {
        component.isOrganizer = true;
        const mockClientSocketService = {
            sendUpdateHistogram: jasmine.createSpy(),
        };
        component.populateHistogram();
        expect(mockClientSocketService.sendUpdateHistogram).toHaveBeenCalledTimes(0);
    });

    it('should call sendUpdateHistogram for all players except Organisateur', () => {
        clientSocketServiceMock.players = [
            { socketId: '123', name: 'Player1', score: 0, activityState: PlayerColor.Red, isAbleToChat: true, isTyping: false },
            { socketId: '124', name: 'Organisateur', score: 0, activityState: PlayerColor.Red, isAbleToChat: true, isTyping: false },
        ];
        clientSocketServiceMock.isOrganizer = true;
        spyOn(clientSocketServiceMock, 'sendUpdateHistogram').and.callThrough();
        fixture = TestBed.createComponent(ButtonResponseComponent);
        component = fixture.componentInstance;
        component.populateHistogram();
        expect(clientSocketServiceMock.sendUpdateHistogram).toHaveBeenCalledTimes(2);
    });

    it('should correctly update the grade of the current answer ', () => {
        const newGrade = 0;
        component.evaluateAnswer(newGrade);
        expect(component.currentEvaluatedAnswer.grade).toEqual(0);
    });

    it('should correctly count grades and send histogram update', () => {
        component['studentGrades'] = {
            player1: 100,
            player2: 50,
            player3: 0,
        };
        const oneHundredPercent = '100%';
        const fiftyPercent = '50%';
        const zeroPercent = '0%';
        const test = { [oneHundredPercent]: 1, [fiftyPercent]: 1, [zeroPercent]: 1 };
        const histogramUpdateDataSpy = spyOn(clientSocketServiceMock, 'sendQrlUpdateHistogram');
        component.updateHistogram();
        expect(histogramUpdateDataSpy).toHaveBeenCalledWith(test);
    });

    it('should emit evaluationPhaseCompleted event with qrlAnswers on endEvaluationPhase', () => {
        answerValidatorMock.qrlAnswers = qrlAnswers;
        component.endEvaluationPhase();
        expect(clientSocketServiceMock.socket.emit).toHaveBeenCalledWith('evaluationPhaseCompleted', qrlAnswers);
    });

    it('should set submitted to true ', () => {
        component.submit();
        expect(component.submitted).toBeTrue();
    });
    it('should emit markInputActivity and start countdown when game mode is RealGame', () => {
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        spyOn(component, 'markFirstInteraction');
        component.markInputActivity();
        expect(clientSocketServiceMock.socket.emit).toHaveBeenCalledWith('markInputActivity');
        expect(timerMock.startCountdown).toHaveBeenCalledWith(DELAY_BEFORE_INPUT_INACTIVITY, { isInputInactivityCountdown: true });
        expect(component.markFirstInteraction).toHaveBeenCalled();
    });

    it('should populate histogram events for QCM question but not sendUpdateHistogram for 0 players  ', () => {
        component.isOrganizer = true;
        spyOnProperty(component, 'isCurrentQuestionQcm').and.returnValue(true);
        const mockClientSocketService = {
            sendUpdateHistogram: jasmine.createSpy(),
        };
        component.populateHistogram();
        expect(mockClientSocketService.sendUpdateHistogram).toHaveBeenCalledTimes(0);
    });

    it('should emit resetPlayersActivityState when the user is the organizer', () => {
        component.isOrganizer = true;
        component.updateGameQuestions();
        expect(clientSocketServiceMock.socket.emit).toHaveBeenCalledWith('resetPlayersActivityState');
    });

    it('should call focusElement with buttonFocus when buttonFocus is present', () => {
        component['hasFocusedOnce'] = false;
        component.buttonFocus = {
            nativeElement: {
                focus: () => {
                    return;
                },
            },
        };
        spyOn(component, 'focusElement');
        component.ngAfterViewChecked();
        expect(component.focusElement).toHaveBeenCalledWith(component.buttonFocus);
    });
    it('should call focusElement with answerInput when answerInput is present', () => {
        component['hasFocusedOnce'] = false;
        component.answerInput = {
            nativeElement: {
                focus: () => {
                    return;
                },
            },
        };
        spyOn(component, 'focusElement');
        component.ngAfterViewChecked();
        expect(component.focusElement).toHaveBeenCalledWith(component.answerInput);
    });
});
