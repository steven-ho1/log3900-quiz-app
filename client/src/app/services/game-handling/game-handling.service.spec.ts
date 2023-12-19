import { formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { QRL_DURATION } from '@app/constants/in-game';
import { Game, GameInfo, Question, QuestionType } from '@common/game';
import { of, throwError } from 'rxjs';
import { GameHandlingService } from './game-handling.service';

describe('GameHandlingService', () => {
    const MOCK_QUESTIONS: Question[] = [
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

    const MOCK_GAME: Game = {
        id: '0',
        title: 'Test Game',
        description: 'Test Description',
        duration: 30,
        lastModification: formatDate(new Date(), 'yyyy-MM-dd', 'en'),
        isVisible: false,
        questions: MOCK_QUESTIONS,
    };

    let service: GameHandlingService;
    let httpClientSpy: jasmine.SpyObj<HttpClient>;

    beforeEach(() => {
        httpClientSpy = jasmine.createSpyObj('HttpClient', ['get', 'post', 'patch', 'delete']);
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [GameHandlingService, { provide: HttpClient, useValue: httpClientSpy }],
        });
        service = TestBed.inject(GameHandlingService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('getGames should send a get request', (done) => {
        httpClientSpy.get.and.returnValue(of([MOCK_GAME]));
        service.getGames().subscribe((games) => {
            expect(games).toEqual([MOCK_GAME]);
            done();
        });
        expect(httpClientSpy.get.calls.count()).withContext('one call').toBe(1);
    });

    it('should show an alert when there is an error', (done) => {
        const errorResponse = {
            error: new Error('Test error message'),
            status: 500,
            statusText: 'Internal Server Error',
        };

        httpClientSpy.get.and.returnValue(throwError(() => errorResponse));
        spyOn(window, 'alert');
        service.getGames().subscribe({
            next: () => {
                expect(window.alert).toHaveBeenCalledWith('Test error message');
                done();
            },
            error: () => {
                done.fail('The error callback should not have been called');
            },
        });
    });

    it('currentGame should be able to be set', () => {
        service.currentGame = MOCK_GAME;
        expect(service.currentGame).toEqual(MOCK_GAME);
    });

    it('modifyGame should send a patch request', (done) => {
        httpClientSpy.patch.and.returnValue(of([MOCK_GAME]));
        service.modifyGame(MOCK_GAME).subscribe((games) => {
            expect(games).toEqual([MOCK_GAME]);
            done();
        });
        expect(httpClientSpy.patch.calls.count()).withContext('one call').toBe(1);
    });

    it('addGame should send a post request', (done) => {
        httpClientSpy.post.and.returnValue(of([MOCK_GAME]));
        service.addGame(MOCK_GAME).subscribe((games) => {
            expect(games).toEqual([MOCK_GAME]);
            done();
        });
        expect(httpClientSpy.post.calls.count()).withContext('one call').toBe(1);
    });

    it('changeVisibility should send a patch request', (done) => {
        httpClientSpy.patch.and.returnValue(of([MOCK_GAME]));
        service.changeVisibility(MOCK_GAME).subscribe((games) => {
            expect(games).toEqual([MOCK_GAME]);
            done();
        });
        expect(httpClientSpy.patch.calls.count()).withContext('one call').toBe(1);
    });

    it('export should send a get request', (done) => {
        httpClientSpy.get.and.returnValue(of(MOCK_GAME));
        service.export(MOCK_GAME.id).subscribe((game) => {
            expect(game).toEqual(MOCK_GAME);
            done();
        });
        expect(httpClientSpy.get.calls.count()).withContext('one call').toBe(1);
    });

    it('deleteGame should send a delete request', (done) => {
        httpClientSpy.delete.and.returnValue(of(null));
        service.deleteGame(MOCK_GAME.id).subscribe(() => {
            done();
        });
        expect(httpClientSpy.delete.calls.count()).withContext('one call').toBe(1);
    });

    it('setCurrentQuestion should update current question', () => {
        const testQuestion = 'What is the capital of France?';
        service.setCurrentQuestion(testQuestion);
        service.currentQuestion$.subscribe((question) => {
            expect(question).toEqual(testQuestion);
        });
    });

    it("getCurrentQuestionDuration should return current game's QCM duration if question is QCM", () => {
        service.currentGame = MOCK_GAME;
        service.currentQuestionId = 0;
        expect(service.getCurrentQuestionDuration()).toEqual(service.currentGame.duration);
    });

    it('getCurrentQuestionDuration should return 60 if question is QRL', () => {
        service.currentGame = MOCK_GAME;
        service.currentQuestionId = 1;
        expect(service.getCurrentQuestionDuration()).toEqual(QRL_DURATION);
    });

    it('setScore should update the score', () => {
        const testNewScore = 42;
        service.setScore(testNewScore);
        service.score$.subscribe((score) => {
            expect(score).toEqual(testNewScore);
        });
    });

    it('setCurrentQuestionId should update current questionId', () => {
        const testQuestionId = 123;
        service.setCurrentQuestionId(testQuestionId);
        expect(service.currentQuestionId).toEqual(testQuestionId);
    });

    it('incrementScore should increment the score', () => {
        const initialScore = 10;
        const incrementAmount = 5;
        service.setScore(initialScore);
        service.incrementScore(incrementAmount);
        service.score$.subscribe((score) => {
            expect(score).toEqual(initialScore + incrementAmount);
        });
    });

    it('verifyAdminPassword should verify the admin password', (done) => {
        const mockResponse = { valid: true };
        httpClientSpy.post.and.returnValue(of(mockResponse));
        service.verifyAdminPassword('admin123').subscribe((isValid) => {
            expect(isValid).toBeTrue();
            done();
        });
        expect(httpClientSpy.post.calls.count()).toBe(1);
    });

    it('getHistory should send a get request and return the history', () => {
        const games: GameInfo[] = [{ name: 'test', date: '2002-09-13 12:00:00', numberPlayers: 1, bestScore: 500 }];
        httpClientSpy.get.and.returnValue(of(games));
        service.getHistory().subscribe((response) => {
            expect(httpClientSpy.get).toHaveBeenCalled();
            expect(response).toEqual(games);
        });
    });

    it('resetHistory should send a delete request and return an empty array', () => {
        httpClientSpy.delete.and.returnValue(of([]));
        service.resetHistory().subscribe((response) => {
            expect(httpClientSpy.delete).toHaveBeenCalled();
            expect(response).toEqual([]);
        });
    });

    it('resetHistogramDataForQuestion should reset histogram data', () => {
        const questionId = 1;
        const newData = { answer1: 10, answer2: 5 };
        service.updateHistogramDataForQuestion(questionId, newData);
        service.resetHistogramDataForQuestion();
        expect(service.getAllHistogramData()).toEqual({});
    });
    it('getCorrectAnswersForCurrentQuestion should return correct answers for the current question', () => {
        service.currentGame = {
            ...MOCK_GAME,
            questions: [
                {
                    ...MOCK_QUESTIONS[0],
                },
            ],
        };
        service.currentQuestionId = 0;
        const correctAnswers = service.getCorrectAnswersForCurrentQuestion();
        expect(correctAnswers).toEqual(['Paris']);
    });

    it('isCurrentQuestionQcm should return true if current question is of type QCM', () => {
        service.currentGame = {
            ...MOCK_GAME,
            questions: [
                {
                    ...MOCK_QUESTIONS[0],
                },
            ],
        };
        service.currentQuestionId = 0;
        const isQcm = service.isCurrentQuestionQcm();
        expect(isQcm).toBeTrue();
    });
    it('getCorrectAnswersForCurrentQuestion should return an empty array if current question has no choices', () => {
        service.currentGame = {
            ...MOCK_GAME,
            questions: [
                {
                    text: 'Test',
                    points: 10,
                    type: QuestionType.QCM,
                },
            ],
        };
        service.currentQuestionId = 0;
        const correctAnswers = service.getCorrectAnswersForCurrentQuestion();
        expect(correctAnswers).toEqual([]);
    });
});
