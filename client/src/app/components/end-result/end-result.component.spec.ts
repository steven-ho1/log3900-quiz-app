import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { HistogramComponent } from '@app/components/histogram/histogram.component';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game, Question, QuestionType } from '@common/game';
import { PlayerColor } from '@common/lobby';
import { EndResultComponent } from './end-result.component';
describe('EndResultComponent', () => {
    let component: EndResultComponent;
    let fixture: ComponentFixture<EndResultComponent>;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let gameHandlingServiceMock: jasmine.SpyObj<GameHandlingService>;
    let socketMock: SocketMock;
    let questionMocks: Question[];
    let gameMock: Game;

    beforeEach(() => {
        clientSocketServiceMock = new ClientSocketServiceMock();
        questionMocks = [
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
        ];

        gameMock = {
            id: '1',
            title: 'Game 1',
            description: 'Test ',
            duration: 5,
            lastModification: '2018-11-13',
            questions: [questionMocks[0], questionMocks[0]],
        };
        gameHandlingServiceMock = jasmine.createSpyObj('GameHandlingService', [
            'getAllHistogramData',
            'resetHistogramDataForQuestion',
            'setCurrentQuestionId',
            'getCorrectAnswersForCurrentQuestion',
        ]);
        TestBed.configureTestingModule({
            imports: [HttpClientModule],
            declarations: [EndResultComponent, HistogramComponent],
            providers: [
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(EndResultComponent);
        component = fixture.componentInstance;
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        socketMock.clientUniqueEvents.clear();
        gameHandlingServiceMock.currentGame = gameMock;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should call configureBaseSocketFeatures and emit getPlayers event on component initialization', () => {
        spyOn(component, 'configureBaseSocketFeatures');
        component.ngOnInit();
        expect(component.configureBaseSocketFeatures).toHaveBeenCalled();
        expect(socketMock.emit).toHaveBeenCalledWith('getPlayers');
    });

    it('should not set the previous question if current question is the first question', () => {
        component.currentQuestionId = 0;
        component.previousQuestion();
        expect(component.currentQuestionId).toBe(0);
    });

    it('should set the previous question if current question is not the first question', () => {
        const updateQuestionSpy = spyOn(component, 'updateCurrentQuestionText');
        component.currentQuestionId = 1;
        component.previousQuestion();
        expect(component.currentQuestionId).toBe(0);
        expect(updateQuestionSpy).toHaveBeenCalled();
    });

    it('should not set the next question if current question is the last question', () => {
        component.allHistogramData = {
            [1]: { choice1: 10, choice2: 15 },
            [2]: { choice1: 5, choice2: 20 },
        };
        component.currentQuestionId = 1;
        component.nextQuestion();
        expect(component.currentQuestionId).toBe(1);
    });

    it('should set the next question if current question is not the last question', () => {
        const updateQuestionSpy = spyOn(component, 'updateCurrentQuestionText');
        component.allHistogramData = {
            [1]: { choice1: 10, choice2: 15 },
            [2]: { choice1: 5, choice2: 20 },
            [3]: { choice1: 8, choice2: 12 },
        };
        const un = 1;
        component.currentQuestionId = un;
        component.nextQuestion();
        expect(component.currentQuestionId).toBe(un + un);
        expect(updateQuestionSpy).toHaveBeenCalled();
    });

    it('should remove "latestPlayerList" listener on component destruction', () => {
        socketMock.removeAllListeners = jasmine.createSpy('removeAllListeners');
        component.ngOnDestroy();
        expect(socketMock.removeAllListeners).toHaveBeenCalledWith('latestPlayerList');
    });

    it('should handle "latestPlayerList" event by assigning lobbyDetails.players to players member', () => {
        const testLobby = {
            players: [
                {
                    socketId: 'testSocketID',
                    name: 'testName',
                    answerSubmitted: true,
                    score: 1,
                    bonusTimes: 1,
                    activityState: PlayerColor.Red,
                    isAbleToChat: true,
                    isTyping: false,
                },
            ],
        };

        component.configureBaseSocketFeatures();
        socketMock.simulateServerEmit('latestPlayerList', testLobby);
        expect(component.players).toEqual(testLobby.players);
    });
});
