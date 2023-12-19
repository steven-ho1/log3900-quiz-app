/* eslint-disable max-lines */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { LobbyDetails, Player, PlayerColor } from '@common/lobby';
import { PlayerListComponent } from './player-list.component';
// const REVERT_SORT = -1;
describe('PlayerListComponent', () => {
    let component: PlayerListComponent;
    let fixture: ComponentFixture<PlayerListComponent>;
    let socketMock: SocketMock;
    let clientSocketServiceMock: ClientSocketServiceMock;

    const lobbyDetails: LobbyDetails = {
        isLocked: true,
        players: [
            {
                socketId: 'id1',
                name: 'player1',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
            {
                socketId: 'id2',
                name: 'player2',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
        ],
        bannedNames: [],
        chat: [],
        qrlAnswers: [],
    };

    beforeEach(() => {
        clientSocketServiceMock = new ClientSocketServiceMock();
        TestBed.configureTestingModule({
            declarations: [PlayerListComponent],
            imports: [MatSnackBarModule],
            providers: [{ provide: ClientSocketService, useValue: clientSocketServiceMock }],
        });
        fixture = TestBed.createComponent(PlayerListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        socketMock.clientUniqueEvents.clear();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should set the base socket features on ngOnInit', () => {
        const configSpy = spyOn(component, 'configureBaseSocketFeatures');
        component.ngOnInit();
        expect(configSpy).toHaveBeenCalled();
        expect(socketMock.emit).toHaveBeenCalledWith('getPlayers');
    });

    it('should set the list of players when the list is empty and sort it', () => {
        component.players = [];
        const sortSpy = spyOn(component, 'sortPlayers');
        const lobbyDetailsMock = lobbyDetails;
        const event = 'latestPlayerList';
        socketMock.simulateServerEmit(event, lobbyDetailsMock);
        expect(component.players).toBe(lobbyDetailsMock.players);
        expect(sortSpy).toHaveBeenCalled();
    });
    it('should update the score when event from server', () => {
        component.property = 'name';
        component.players = [
            {
                socketId: 'id1',
                name: 'player1',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
            {
                socketId: 'id2',
                name: 'player2',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
        ];
        const event = 'scoreUpdated';
        const playerToUpdateMock = {
            socketId: 'id1',
            name: 'player1',
            answerSubmitted: true,
            score: 50,
            bonusTimes: 0,
            activityState: 'red',
            isAbleToChat: true,
        };
        const sortSpy = spyOn(component, 'sortPlayers');

        socketMock.simulateServerEmit(event, playerToUpdateMock);
        expect(component.players[0].score).toBe(playerToUpdateMock.score);
        expect(component.players[1].score).toBe(0);
        expect(sortSpy).not.toHaveBeenCalled();

        component.property = 'score';
        socketMock.simulateServerEmit(event, playerToUpdateMock);
        expect(sortSpy).toHaveBeenCalled();
    });
    it('should change the property of players who left', () => {
        component.players = lobbyDetails.players;
        const event = 'latestPlayerList';
        const playerListMock = [
            {
                socketId: 'id1',
                name: 'player1',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Green,
                isAbleToChat: true,
                isTyping: false,
            },
        ];
        const lobbyDetailsMock = lobbyDetails;
        lobbyDetailsMock.players = playerListMock;
        const sortSpy = spyOn(component, 'sortPlayers');

        socketMock.simulateServerEmit(event, lobbyDetailsMock);
        expect(component.players.length).toBe(2);
        expect(component.players[0].activityState).toBe(PlayerColor.Green);
        expect(component.players[1].activityState).toBe(PlayerColor.Black);
        expect(sortSpy).toHaveBeenCalled();
    });

    it('should remove listeners on component destruction', () => {
        spyOn(socketMock, 'removeAllListeners');
        component.ngOnDestroy();
        expect(socketMock.removeAllListeners).toHaveBeenCalledWith('latestPlayerList');
        expect(socketMock.removeAllListeners).toHaveBeenCalledWith('scoreUpdated');
    });

    it('should toggle mute status and emit toggleMute event on toggleMute()', () => {
        const player: Player = {
            socketId: 'testSocketId',
            name: 'TestPlayer',
            answerSubmitted: false,
            score: 0,
            activityState: PlayerColor.Red,
            isAbleToChat: true,
            bonusTimes: 0,
            isTyping: false,
        };

        component.toggleMute(player);

        expect(player.isAbleToChat).toBeFalse();
        expect(clientSocketServiceMock.socket.emit).toHaveBeenCalledWith('toggleMute', player);
    });
    it('should compare the players by activityState and name when activityState is the same', () => {
        component.ascendingOrder = true;
        const playerListMock = [
            {
                socketId: 'id1',
                name: 'aaaa',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Green,
                isAbleToChat: true,
                isTyping: false,
            },
            {
                socketId: 'id2',
                name: 'bbbb',
                answerSubmitted: true,
                score: 100,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
        ];
        component.players = playerListMock.slice();

        component.property = 'activityState';
        expect(component.compare(component.players[0], component.players[1])).toBeGreaterThan(0);
        playerListMock[0].activityState = PlayerColor.Red;
        component.players = playerListMock.slice();
        expect(component.compare(component.players[0], component.players[1])).toBeLessThan(0);
        component.ascendingOrder = false;
        expect(component.compare(component.players[0], component.players[1])).toBeGreaterThan(0);
    });

    it('should sort the players by score and name when score is the same', () => {
        component.ascendingOrder = true;
        const playerListMock = [
            {
                socketId: 'id1',
                name: 'aaaa',
                answerSubmitted: true,
                score: 100,
                bonusTimes: 0,
                activityState: PlayerColor.Green,
                isAbleToChat: true,
                isTyping: false,
            },
            {
                socketId: 'id2',
                name: 'bbbb',
                answerSubmitted: true,
                score: 25,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
        ];
        component.players = playerListMock.slice();

        component.property = 'score';
        expect(component.compare(component.players[0], component.players[1])).toBeGreaterThan(0);
        playerListMock[0].score = 25;
        component.players = playerListMock.slice();
        expect(component.compare(component.players[0], component.players[1])).toBeLessThan(0);
        component.ascendingOrder = false;
        expect(component.compare(component.players[0], component.players[1])).toBeGreaterThan(0);
    });

    it('should sort the players by name', () => {
        component.ascendingOrder = true;
        const playerListMock = [
            {
                socketId: 'id1',
                name: 'aaaa',
                answerSubmitted: true,
                score: 0,
                bonusTimes: 0,
                activityState: PlayerColor.Green,
                isAbleToChat: true,
                isTyping: false,
            },
            {
                socketId: 'id2',
                name: 'bbbb',
                answerSubmitted: true,
                score: 100,
                bonusTimes: 0,
                activityState: PlayerColor.Red,
                isAbleToChat: true,
                isTyping: false,
            },
        ];
        component.players = playerListMock.slice();

        component.property = 'name';
        component.sortPlayers();
        expect(component.players[0]).toEqual(playerListMock[0]);
        expect(component.players[1]).toEqual(playerListMock[1]);

        component.ascendingOrder = false;
        component.sortPlayers();
        expect(component.players[1]).toEqual(playerListMock[0]);
        expect(component.players[0]).toEqual(playerListMock[1]);
    });

    it('should toggle order and sort ', () => {
        const sortSpy = spyOn(component, 'sortPlayers');
        component.ascendingOrder = true;
        component.toggleSortOrder();
        expect(component.ascendingOrder).toBeFalse();
        expect(sortSpy).toHaveBeenCalled();
    });

    it('should change the sort property and sort ', () => {
        const sortSpy = spyOn(component, 'sortPlayers');
        component.property = 'name';
        const scoreProperty = 'score';
        component.setSortingPropertyAndSort(scoreProperty);
        expect(component.property).toBe(scoreProperty);
        expect(sortSpy).toHaveBeenCalled();
    });
    it('should return the correct CSS class for player activity state', () => {
        const redPlayer: Player = {
            socketId: '1',
            name: 'Red Player',
            answerSubmitted: true,
            score: 0,
            bonusTimes: 0,
            activityState: PlayerColor.Red,
            isAbleToChat: true,
            isTyping: false,
        };
        const yellowPlayer: Player = {
            socketId: '2',
            name: 'Yellow Player',
            answerSubmitted: true,
            score: 0,
            bonusTimes: 0,
            activityState: PlayerColor.Yellow,
            isAbleToChat: true,
            isTyping: false,
        };
        const greenPlayer: Player = {
            socketId: '3',
            name: 'Green Player',
            answerSubmitted: true,
            score: 0,
            bonusTimes: 0,
            activityState: PlayerColor.Green,
            isAbleToChat: true,
            isTyping: false,
        };
        const blackPlayer: Player = {
            socketId: '4',
            name: 'Black Player',
            answerSubmitted: true,
            score: 0,
            bonusTimes: 0,
            activityState: PlayerColor.Black,
            isAbleToChat: true,
            isTyping: false,
        };

        expect(component.getActivityClass(redPlayer)).toBe('red');
        expect(component.getActivityClass(yellowPlayer)).toBe('yellow');
        expect(component.getActivityClass(greenPlayer)).toBe('green');
        expect(component.getActivityClass(blackPlayer)).toBe('black');
    });
});
