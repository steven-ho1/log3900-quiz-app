import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { SocketMock } from '@app/classes/socket-mock';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io-client';
import { ClientSocketService } from './client-socket.service';

describe('ClientSocketService', () => {
    let service: ClientSocketService;
    let snackBarMock: jasmine.SpyObj<MatSnackBar>;
    let routerMock: jasmine.SpyObj<Router>;
    let nEmittedEvents: number;
    let socketMock: SocketMock;

    beforeEach(() => {
        snackBarMock = jasmine.createSpyObj('MatSnackBar', ['open']);
        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        TestBed.configureTestingModule({
            providers: [
                { provide: Router, useValue: routerMock },
                { provide: MatSnackBar, useValue: snackBarMock },
            ],
        });
        service = TestBed.inject(ClientSocketService);
        service.socket = new SocketMock() as unknown as Socket;
        socketMock = service.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        nEmittedEvents = 0;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('isSocketAlive should return true if the socket is still connected', () => {
        service.socket.connected = true;
        const isAlive = service.isSocketAlive();
        expect(isAlive).toBeTruthy();
    });

    it('isSocketAlive should return false if the socket is no longer connected', () => {
        service.socket.connected = false;
        const isAlive = service.isSocketAlive();
        expect(isAlive).toBeFalsy();
    });

    it('isSocketAlive should return false if the socket is not defined', () => {
        (service.socket as unknown) = undefined;
        const isAlive = service.isSocketAlive();
        expect(isAlive).toBeFalsy();
    });

    it('connect should call listenForGameClosureByOrganiser', () => {
        spyOn(service, 'isSocketAlive').and.returnValue(false);
        spyOn(service, 'listenForGameClosureByOrganiser');

        service.connect();
        expect(service.listenForGameClosureByOrganiser).toHaveBeenCalled();
    });

    it('should not connect when socket is already alive', () => {
        spyOn(service, 'isSocketAlive').and.returnValue(true);
        service.connect();

        expect(socketMock.serverEvents.get('disconnect')).toBeUndefined();
        expect(socketMock.serverEvents.get('lobbyClosed')).toBeUndefined();
    });

    it('giveOrganiserPermissions should set isOrganizer and playerName members to true', () => {
        service.isOrganizer = false;
        service.playerName = '';

        service.giveOrganiserPermissions();
        expect(service.isOrganizer).toBeTrue();
        expect(service.playerName).toEqual('Organisateur');
    });

    it('resetPlayerInfo should reset the player info', () => {
        service.resetPlayerInfo();
        expect(service.isOrganizer).toBeFalse();
        expect(service.playerName).toBe('');
    });

    it('resetPlayerInfo should emit a leaveLobby event', () => {
        service.resetPlayerInfo();
        expect(service.socket.emit).toHaveBeenCalledWith('leaveLobby');
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });

    it("should handle lobbyClosed event by navigating to the main menu and opening a snackbar if reason is 'NO HOST'", () => {
        const event = 'lobbyClosed';
        const reason = 'NO HOST';
        const message = 'Closed due to no host';

        service.listenForGameClosureByOrganiser();
        socketMock.simulateServerEmit(event, reason, message);
        expect(routerMock.navigate).toHaveBeenCalledWith([Route.MainMenu]);
        expect(snackBarMock.open).toHaveBeenCalledWith(message, '', SNACK_BAR_ERROR_CONFIGURATION);
    });

    it("should handle lobbyClosed event by opening a snackBar with a clickable action if reason other than 'NO HOST'", () => {
        const event = 'lobbyClosed';
        const message = 'You have been banned';
        const reason = 'BAN';
        const observableMock: Observable<void> = new Observable((subscriber) => subscriber.next());
        service.pin = '1234';

        snackBarMock.open.and.returnValue({
            onAction: () => observableMock,
        } as MatSnackBarRef<TextOnlySnackBar>);

        service.listenForGameClosureByOrganiser();
        socketMock.simulateServerEmit(event, reason, message);
        expect(snackBarMock.open).toHaveBeenCalledWith(message, 'Rentrer', SNACK_BAR_ERROR_CONFIGURATION);
        expect(socketMock.emit).toHaveBeenCalledWith('validatePin', service.pin);
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });

    it('should listen for histogram update', (done) => {
        const updateHistogramObservable = service.listenUpdateHistogram();
        const histogramData = { key1: 1, key2: 2, key3: 3 };

        updateHistogramObservable.subscribe((data) => {
            expect(data).toEqual(histogramData);
            done();
        });

        socketMock.simulateServerEmit('updateHistogram', histogramData);
    });

    it('should listen for qrl histogram update', (done) => {
        const updateHistogramObservable = service.listenQrlUpdateHistogram();
        const histogramData = { key1: 1, key2: 2, key3: 3 };

        updateHistogramObservable.subscribe((data) => {
            expect(data).toEqual(histogramData);
            done();
        });

        socketMock.simulateServerEmit('qrlUpdateHistogram', histogramData);
    });

    it('should emit a histogramUpdate event with histogram data', () => {
        const histogramData = { key1: 1, key2: 2, key3: 3 };

        service.sendUpdateHistogram(histogramData);
        expect(socketMock.emit).toHaveBeenCalledWith('histogramUpdate', histogramData);
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });

    it('should emit a resetHistogram event to the server', () => {
        service.sendResetHistogram();
        expect(socketMock.emit).toHaveBeenCalledWith('resetHistogram');
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });

    it('should emit a sendQrlUpdateHistogram event with histogram data', () => {
        const histogramData = { key1: 1, key2: 2, key3: 3 };

        service.sendQrlUpdateHistogram(histogramData);
        expect(socketMock.emit).toHaveBeenCalledWith('qrlHistogramUpdate', histogramData);
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);
    });
});
