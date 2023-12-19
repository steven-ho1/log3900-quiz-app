import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { BONUS_FACTOR, TIME_OUT } from '@app/constants/in-game';
import { SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { Button } from '@app/interfaces/button-model';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from '@app/services/timer/timer.service';
import { Game, Question, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Answer } from '@common/lobby';
import { AnswerValidatorService } from './answer-validator.service';

describe('AnswerValidatorService', () => {
    let service: AnswerValidatorService;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let gameHandlingServiceMock: jasmine.SpyObj<GameHandlingService>;
    let timerServiceMock: jasmine.SpyObj<TimerService>;
    let snackBarMock: jasmine.SpyObj<MatSnackBar>;
    let socketMock: SocketMock;
    let questionMocks: Question[];
    let gameMock: Game;
    let buttonMocks: Button[];
    let qrlAnswers: Answer[];

    beforeEach(() => {
        questionMocks = [
            {
                text: 'What is the capital of France?',
                points: 10,
                type: QuestionType.QCM,
                choices: [
                    { text: 'Paris', isCorrect: true },
                    { text: 'London', isCorrect: false },
                ],
            },
        ];

        gameMock = {
            id: '1',
            title: 'Game 1',
            description: 'Test ',
            duration: 5,
            lastModification: '2018-11-13',
            questions: [questionMocks[0], questionMocks[0]],
        };

        buttonMocks = [
            {
                color: 'white',
                selected: true,
                text: 'Test1',
                isCorrect: true,
                id: 1,
            },
            {
                color: 'white',
                selected: true,
                text: 'Test2',
                isCorrect: true,
                id: 2,
            },
            {
                color: 'white',
                selected: false,
                text: 'Test2',
                isCorrect: true,
                id: 2,
            },
            {
                color: 'white',
                selected: true,
                text: 'Test3',
                isCorrect: false,
                id: 3,
            },
        ];

        qrlAnswers = [
            { submitter: 'player1', questionType: QuestionType.QRL, text: 'Hello', grade: 1 },
            { submitter: 'player2', questionType: QuestionType.QRL, text: 'World', grade: 0.5 },
        ];
        clientSocketServiceMock = new ClientSocketServiceMock();
        gameHandlingServiceMock = jasmine.createSpyObj('GameHandlingService', ['isCurrentQuestionQcm', 'incrementScore']);
        timerServiceMock = jasmine.createSpyObj('TimerService', ['startCountdown', 'stopCountdown']);
        snackBarMock = jasmine.createSpyObj('MatSnackBar', ['open']);
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule, MatSnackBarModule],
            providers: [
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
                { provide: MatSnackBar, useValue: snackBarMock },
                { provide: TimerService, useValue: timerServiceMock },
            ],
        });
        service = TestBed.inject(AnswerValidatorService);
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        gameHandlingServiceMock.currentQuestionId = 0;
        gameHandlingServiceMock.currentGame = gameMock;
        service.buttons = buttonMocks;
        spyOn(socketMock, 'emit').and.callThrough();
        service.answerForm = new FormControl('');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('submitAnswer should do nothing if the answer is being processed', () => {
        service.isProcessing = true;
        service.submitAnswer(false);
        expect(service.answerForm.enabled).toBeTrue();
    });

    it('submitAnswer should consider a QCM answer as correct if all correct answers have been selected', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        service.buttons = [buttonMocks[0], buttonMocks[1]];
        service.submitAnswer(true);
        expect(service.isProcessing).toBeTrue();
        expect(service.isAnswerCorrect).toBeTrue();
    });

    it('submitAnswer should consider a QCM answer as incorrect if not all correct buttons have been selected', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        service.buttons = [buttonMocks[0], buttonMocks[1], buttonMocks[2]];
        service.submitAnswer(true);
        expect(service.isAnswerCorrect).toBeFalse();
    });

    it('submitAnswer should consider a QCM answer as incorrect if at last one wrong button has been selected', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        service.submitAnswer(true);
        expect(service.isAnswerCorrect).toBeFalse();
    });

    it('submitAnswer should stop the countdown and process the answer if the game mode is Testing', () => {
        spyOn(service, 'processAnswer');
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        service.submitAnswer(false);
        expect(timerServiceMock.stopCountdown).toHaveBeenCalled();
        expect(service.processAnswer).toHaveBeenCalled();
    });

    it('submitAnswer should emit answerSubmitted event with a QCM answer if the game mode is RealGame and the question type is QCM', () => {
        const submittedFromTimer = true;
        service.isAnswerCorrect = false;
        clientSocketServiceMock.playerName = 'joueur';
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        const qcmAnswer = { submitter: 'joueur', questionType: QuestionType.QCM, isCorrect: service.isAnswerCorrect, grade: null };
        service.submitAnswer(submittedFromTimer);
        expect(socketMock.emit).toHaveBeenCalledWith('answerSubmitted', qcmAnswer, submittedFromTimer);
    });

    it('submitAnswer should emit answerSubmitted event with a QRL answer if the game mode is RealGame and the question type is QRL', () => {
        const submittedFromTimer = true;
        service.answerForm.setValue('test');
        clientSocketServiceMock.playerName = 'joueur';
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(false);
        const qcmAnswer = { submitter: 'joueur', questionType: QuestionType.QRL, text: service.answerForm.value, grade: null };
        service.submitAnswer(submittedFromTimer);
        expect(socketMock.emit).toHaveBeenCalledWith('answerSubmitted', qcmAnswer, submittedFromTimer);
    });

    it('processAnswer should open a snackBar indicating 0 points if game mode is QCM and the answer is wrong', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        service.isAnswerCorrect = false;
        service.processAnswer();
        expect(snackBarMock.open).toHaveBeenCalledWith('+0 points ❌', '', SNACK_BAR_NORMAL_CONFIGURATION);
    });

    it('processAnswer should open a snackBar indicating 0 points if the game mode is Testing and the answer is wrong', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(false);
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        service.isAnswerCorrect = false;
        service.processAnswer();
        expect(snackBarMock.open).toHaveBeenCalledWith('+0 points ❌', '', SNACK_BAR_NORMAL_CONFIGURATION);
    });

    it('processAnswer should consider a QRL answer as incorrect if the attributed grade is 0', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(false);
        service.grade = 0;
        service.processAnswer();
        expect(service.isAnswerCorrect).toBeFalse();
    });

    it('processAnswer should consider a QRL answer as correct if the attributed grade is greater than 0', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(false);
        service.grade = 0.5;
        service.processAnswer();
        expect(service.isAnswerCorrect).toBeTrue();
    });

    it('processAnswer should increment the score and open a snackBar if the answer is correct', () => {
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        service.isAnswerCorrect = true;
        service.processAnswer();
        expect(service.isAnswerCorrect).toBeTrue();
        expect(gameHandlingServiceMock.incrementScore).toHaveBeenCalled();
        expect(snackBarMock.open).toHaveBeenCalled();
    });

    it('processAnswer should set showCorrectButtons or showWrongButtons to true on buttons depending on if the button represents\
        the correct answer or not', () => {
        service.processAnswer();
        for (const button of service.buttons) {
            if (button.isCorrect) expect(button.showCorrectButtons).toBeTrue();
            if (!button.isCorrect) expect(button.showWrongButtons).toBeTrue();
        }
    });

    it('processAnswer should start countdown if the game mode is Testing', () => {
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        service.processAnswer();
        expect(timerServiceMock.startCountdown).toHaveBeenCalledWith(TIME_OUT, { isQuestionTransition: true });
    });

    it('giveBonus should give bonus if the current question is QCM and the player has the bonus', () => {
        const currentRewardedPoints = 10;
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        service.hasBonus = true;
        expect(service['giveBonus'](currentRewardedPoints)).toEqual(currentRewardedPoints * BONUS_FACTOR);
    });

    it('giveBonus should give bonus if the current question is QCM and the game mode is testing', () => {
        const currentRewardedPoints = 10;
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        service.hasBonus = false;
        expect(service['giveBonus'](currentRewardedPoints)).toEqual(currentRewardedPoints * BONUS_FACTOR);
    });

    it('giveBonus should increment bonusTimes and emit updateBonusTimes event if the player gets a bonus', () => {
        const currentRewardedPoints = 10;
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(true);
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        service.bonusTimes = 0;
        service['giveBonus'](currentRewardedPoints);
        expect(service.bonusTimes).toEqual(1);
        expect(socketMock.emit).toHaveBeenCalledWith('updateBonusTimes', service.bonusTimes);
    });

    it('giveBonus should not give bonus if the current question is QRL', () => {
        const currentRewardedPoints = 10;
        gameHandlingServiceMock.isCurrentQuestionQcm.and.returnValue(false);
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        service.hasBonus = true;
        expect(service['giveBonus'](currentRewardedPoints)).toEqual(0);
    });

    it('prepareNextQuestion should reinitialize necessary properties for the next question', () => {
        spyOn(service.answerForm, 'reset');
        spyOn(service.answerForm, 'enable');

        service.prepareNextQuestion();
        for (const button of service.buttons) {
            expect(button.showCorrectButtons).toBeFalse();
            expect(button.showWrongButtons).toBeFalse();
            expect(button.selected).toBeFalse();
        }
        expect(service.rewardMessage).toEqual('');
        expect(service.isProcessing).toBeFalse();
        expect(service.hasBonus).toBeFalse();
        expect(service.isAnswerCorrect).toBeTrue();
        expect(service.grade).toBeNull();
        expect(service.canLoadNextQuestion).toBeFalse();
        expect(service.isEvaluationPhase).toBeFalse();
        expect(service.answerForm.reset).toHaveBeenCalled();
        expect(service.answerForm.enable).toHaveBeenCalled();
    });

    it('reset should reinitialize every property by calling prepareNextQuestion and reinitializing buttons and bonusTimes', () => {
        spyOn(service, 'prepareNextQuestion');
        service.bonusTimes = 10;
        service.reset();
        expect(service.prepareNextQuestion).toHaveBeenCalled();
        expect(service.buttons).toEqual([]);
        expect(service.bonusTimes).toEqual(0);
    });

    it('should handle qcmEnd event by stopping the countdown and setting canLoadNextQuestion and hasQuestionEnded to true\
        if the user is the organizer', () => {
        const bonusRecipientSocketId = '1';
        clientSocketServiceMock.socket.id = '0';
        clientSocketServiceMock.isOrganizer = true;
        service.canLoadNextQuestion = false;
        service.hasQuestionEnded = false;
        spyOn(service, 'processAnswer');
        socketMock.simulateServerEmit('qcmEnd', bonusRecipientSocketId);
        expect(timerServiceMock.stopCountdown).toHaveBeenCalled();
        expect(service.canLoadNextQuestion).toBeTrue();
        expect(service.hasQuestionEnded).toBeTrue();
        expect(service.processAnswer).not.toHaveBeenCalled();
    });

    it('should handle qcmEnd by calling processAnswer and give a bonus if the player is the bonus recipient', () => {
        const bonusRecipientSocketId = '1';
        clientSocketServiceMock.socket.id = '1';
        service.hasBonus = false;
        clientSocketServiceMock.isOrganizer = false;
        spyOn(service, 'processAnswer');
        socketMock.simulateServerEmit('qcmEnd', bonusRecipientSocketId);
        expect(service.hasBonus).toBeTrue();
        expect(service.processAnswer).toHaveBeenCalled();
    });

    it('should handle qrlEnd event by stopping the countdown and setting isEvaluationPhase to true', () => {
        clientSocketServiceMock.isOrganizer = false;
        service.isEvaluationPhase = false;
        socketMock.simulateServerEmit('qrlEnd', qrlAnswers);
        expect(timerServiceMock.stopCountdown).toHaveBeenCalled();
        expect(service.qrlAnswers).toEqual([]);
        expect(service.isEvaluationPhase).toBeTrue();
    });

    it('should handle qrlEnd event by obtaining the QRL answers from the server if the user is the organizer', () => {
        clientSocketServiceMock.isOrganizer = true;
        socketMock.simulateServerEmit('qrlEnd', qrlAnswers);
        expect(service.qrlAnswers).toEqual(qrlAnswers);
    });

    it('should handle qrlResults event by setting isEvaluationPhase to false for everyone and canLoadNextQuestion and hasQuestionEnded to true\
        if the user is the organizer', () => {
        clientSocketServiceMock.isOrganizer = true;
        service.isEvaluationPhase = true;
        service.canLoadNextQuestion = false;
        service.hasQuestionEnded = false;
        socketMock.simulateServerEmit('qrlResults', qrlAnswers);
        expect(service.isEvaluationPhase).toBeFalse();
        expect(service.canLoadNextQuestion).toBeTrue();
        expect(service.hasQuestionEnded).toBeTrue();
    });

    it('should handle qrlResults event by setting getting and calling processAnswer', () => {
        clientSocketServiceMock.isOrganizer = false;
        clientSocketServiceMock.playerName = qrlAnswers[0].submitter as string;
        socketMock.simulateServerEmit('qrlResults', qrlAnswers);
        expect(service.grade).toEqual(qrlAnswers[0].grade);
    });
});
