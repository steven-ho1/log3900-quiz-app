import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from './timer.service';

describe('TimerService', () => {
    const initialCount = 10;
    const gameHandlingServiceMock: {
        currentQuestionId: number;
        currentGame: {
            questions: string[];
        };
        gameMode: string;
    } = { currentQuestionId: 0, currentGame: { questions: ['', ''] }, gameMode: '' };
    let service: TimerService;
    let socketMock: SocketMock;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let nEmittedEvents: number;
    let isQuestionTransition: boolean;

    beforeEach(() => {
        clientSocketServiceMock = new ClientSocketServiceMock();
        isQuestionTransition = true;

        TestBed.configureTestingModule({
            imports: [MatSnackBarModule, HttpClientTestingModule],
            providers: [
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
            ],
        });

        service = TestBed.inject(TimerService);
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        socketMock.clientUniqueEvents.clear();
        nEmittedEvents = 0;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should handle countdown event by assigning newCount argument to transitionCount if isQuestionTransition is true', () => {
        const event = 'countdown';
        const newCount = 10;
        service.isQuestionTransition = true;
        service.transitionCount = 0;
        service.count = 0;

        socketMock.simulateServerEmit(event, newCount);
        expect(service.transitionCount).toEqual(newCount);
        expect(service.count).toEqual(0);
    });

    it('should handle countdown event by assigning newCount argument to count if isQuestionTransition is false', () => {
        const event = 'countdown';
        const newCount = 10;
        service.isQuestionTransition = false;
        service.transitionCount = 0;
        service.count = 0;

        socketMock.simulateServerEmit(event, newCount);
        expect(service.transitionCount).toEqual(0);
        expect(service.count).toEqual(newCount);
    });

    it('should handle questionTransition event by updating isQuestionTransition and isPanicModeEnabled members', () => {
        const event = 'questionTransition';
        service.isQuestionTransition = false;
        service.isPanicModeEnabled = true;

        socketMock.simulateServerEmit(event, isQuestionTransition);
        expect(service.isQuestionTransition).toBeTrue();
        expect(service.isPanicModeEnabled).toBeFalse();
    });

    it('should handle questionTransition event by assigning result message to transitionMessage member if there is no question left', () => {
        const event = 'questionTransition';
        const resultMessage = 'Résultats';
        const lastQuestionId = 1;
        service.transitionMessage = '';
        gameHandlingServiceMock.currentQuestionId = lastQuestionId;

        socketMock.simulateServerEmit(event, isQuestionTransition);
        expect(service.transitionMessage).toEqual(resultMessage);
    });

    it('should handle questionTransition event by assigning next question message to transitionMessage member if there are questions left', () => {
        const event = 'questionTransition';
        const nextQuestionMessage = 'Prochaine question';
        const notLastQuestionId = 0;
        service.transitionMessage = '';
        gameHandlingServiceMock.currentQuestionId = notLastQuestionId;

        socketMock.simulateServerEmit(event, isQuestionTransition);
        expect(service.transitionMessage).toEqual(nextQuestionMessage);
    });

    it('should handle countdownStarted event by setting isCountdownRunning to true', () => {
        const event = 'countdownStarted';
        service.isCountdownRunning = false;
        socketMock.simulateServerEmit(event);
        expect(service.isCountdownRunning).toBeTrue();
    });

    it('should handle countdownStopped event by setting isCountdownRunning to false', () => {
        const event = 'countdownStopped';
        service.isCountdownRunning = true;
        socketMock.simulateServerEmit(event);
        expect(service.isCountdownRunning).toBeFalse();
    });

    it('startCountdown should emit startCountdown event', () => {
        const event = 'startCountdown';

        service.startCountdown(initialCount, { isQuestionTransition: true });
        expect(socketMock.emit).toHaveBeenCalledWith(
            event,
            initialCount,
            { isQuestionTransition: true, isPanicModeEnabled: false, isInputInactivityCountdown: false },
            gameHandlingServiceMock.gameMode,
        );
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });

    it('stopCountdown should emit stopCountdown event', () => {
        const event = 'stopCountdown';
        service.stopCountdown();
        expect(socketMock.emit).toHaveBeenCalledWith(event);
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });

    it('reset should call stopCountdown and reinitialize every property', () => {
        const currentCount = 10;
        service.count = currentCount;
        service.transitionCount = currentCount;
        service.isQuestionTransition = true;
        service.isPanicModeEnabled = true;
        service.isPanicModeEnabled = true;

        spyOn(service, 'stopCountdown');
        service.reset();
        expect(service.stopCountdown).toHaveBeenCalled();
        expect(service.count).toEqual(0);
        expect(service.transitionCount).toEqual(0);
        expect(service.isQuestionTransition).toBeFalse();
    });
});
