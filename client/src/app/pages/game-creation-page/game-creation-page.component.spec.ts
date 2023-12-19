import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, RouterModule, convertToParamMap } from '@angular/router';
import { ClientSocketServiceMock } from '@app/classes/client-socket-service-mock';
import { SocketMock } from '@app/classes/socket-mock';
import { HeaderComponent } from '@app/components/header/header.component';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { of } from 'rxjs';
import { GameCreationPageComponent } from './game-creation-page.component';

describe('GameCreationPageComponent', () => {
    let component: GameCreationPageComponent;
    let fixture: ComponentFixture<GameCreationPageComponent>;
    let gameHandler: GameHandlingService;
    let routerMock: jasmine.SpyObj<Router>;
    let routeControllerServiceMock: jasmine.SpyObj<RouteControllerService>;
    let socketMock: SocketMock;
    let clientSocketServiceMock: ClientSocketServiceMock;
    let nEmittedEvents: number;
    const gameMock = {
        id: '1',
        title: 'Game 1',
        description: 'Test ',
        duration: 5,
        lastModification: '2018-11-13',
        questions: [],
    };

    beforeEach(() => {
        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        routeControllerServiceMock = jasmine.createSpyObj('RouteControllerService', ['setRouteAccess']);
        clientSocketServiceMock = new ClientSocketServiceMock();

        TestBed.configureTestingModule({
            declarations: [GameCreationPageComponent, HeaderComponent],
            imports: [HttpClientTestingModule, MatIconModule, MatSnackBarModule, BrowserAnimationsModule, RouterModule],
            providers: [
                { provide: Router, useValue: routerMock },
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
                { provide: RouteControllerService, useValue: routeControllerServiceMock },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        queryParams: of(
                            convertToParamMap({
                                search: '',
                            }),
                        ),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(GameCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        gameHandler = TestBed.inject(GameHandlingService);
        socketMock = clientSocketServiceMock.socket as unknown as SocketMock;
        spyOn(socketMock, 'emit').and.callThrough();
        socketMock.clientUniqueEvents.clear();
        nEmittedEvents = 0;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should get the list of games on component initialization', () => {
        const games: Game[] = [gameMock];
        const getGamesSpy = spyOn(gameHandler, 'getGames').and.returnValue(of(games));

        component.ngOnInit();
        expect(getGamesSpy).toHaveBeenCalled();
        expect(component.games).toEqual(games);
    });

    it('should call setRouteAccess from RouteControllerService and configureBaseSocketFeatures on component initialization', () => {
        spyOn(component, 'configureBaseSocketFeatures');
        component.ngOnInit();
        expect(routeControllerServiceMock.setRouteAccess).toHaveBeenCalledWith(Route.Admin, false);
        expect(component.configureBaseSocketFeatures).toHaveBeenCalled();
    });

    it('should remove listeners on component destruction', () => {
        spyOn(socketMock, 'removeAllListeners');
        component.ngOnDestroy();
        expect(socketMock.removeAllListeners).toHaveBeenCalledWith('successfulLobbyCreation');
        expect(socketMock.removeAllListeners).toHaveBeenCalledWith('failedLobbyCreation');
    });

    it('should handle successfulLobbyCreation event by calling giveOrganiserPermissions from ClientSocketService and assigning a new pin', () => {
        const newPin = '1234';
        const event = 'successfulLobbyCreation';
        spyOn(clientSocketServiceMock, 'giveOrganiserPermissions');
        clientSocketServiceMock.pin = '';

        socketMock.simulateServerEmit(event, newPin);
        expect(clientSocketServiceMock.giveOrganiserPermissions).toHaveBeenCalledOnceWith();
        expect(clientSocketServiceMock.pin).toEqual(newPin);
    });

    it('should handle successfulLobbyCreation event by calling setRouteAccess from RouteControllerService and navigating to lobby', () => {
        const event = 'successfulLobbyCreation';

        socketMock.simulateServerEmit(event);
        expect(routeControllerServiceMock.setRouteAccess).toHaveBeenCalledWith(Route.Lobby, true);
        expect(routerMock.navigate).toHaveBeenCalledWith([Route.Lobby]);
    });

    it('should handle failedLobbyCreation event by opening a snackbar', () => {
        const event = 'failedLobbyCreation';
        const reason = 'reason for failed lobby creation';

        spyOn(component['snackBar'], 'open');
        socketMock.simulateServerEmit(event, reason);
        expect(component['snackBar'].open).toHaveBeenCalledWith(reason, '', SNACK_BAR_ERROR_CONFIGURATION);
    });

    it('selectRow should select a row and set selectedGame', () => {
        const mockGames = [
            { id: '0', title: 'Game 1', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
            { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
        ];

        component.games = mockGames;
        component.selectRow(1);

        expect(component.selectedRowIndex).toBe(1);
        expect(component.selectedGame).toEqual(mockGames[1]);
    });

    it('selectRow should clear selection when index is null', () => {
        component.selectedRowIndex = 1;
        component.selectedGame = { id: '2', title: 'Game 3', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] };

        component.selectRow(null);

        expect(component.selectedRowIndex).toBeNull();
        expect(component.selectedGame).toBeNull();
    });

    it('should return true when the list is empty', () => {
        const mockGames: Game[] = [];
        component.games = mockGames;
        expect(component.allGamesAreHiddenOrListIsEmpty()).toBeTrue();
    });

    it('should return true when all games are hidden', () => {
        const mockGames = [
            { id: '0', title: 'Game 1', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
            { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
        ];
        component.games = mockGames;

        expect(component.allGamesAreHiddenOrListIsEmpty()).toBeTrue();
    });

    it('should return false when at least one game is visible', () => {
        const mockGames = [
            { id: '0', title: 'Game 1', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
            { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: true, questions: [] },
        ];
        component.games = mockGames;

        expect(component.allGamesAreHiddenOrListIsEmpty()).toBeFalse();
    });

    it('initializeGame with argument GameMode.Testing should navigate to In-Game page when game is visible and existing', () => {
        const games = [
            { id: '0', title: 'Game 1', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
            { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: true, questions: [] },
        ];
        component.selectedGame = games[1];

        const mockGetGames = spyOn(gameHandler, 'getGames').and.returnValue(of(games));

        component.initializeGame(GameMode.Testing);

        expect(mockGetGames).toHaveBeenCalled();
        expect(component.games).toEqual(games);
        expect(gameHandler.currentGame).toEqual(games[1]);
        expect(gameHandler.gameMode).toEqual(GameMode.Testing);
        expect(routeControllerServiceMock.setRouteAccess).toHaveBeenCalledWith(Route.InGame, true);
        expect(routerMock.navigate).toHaveBeenCalledWith([Route.InGame]);
    });

    it('initializeGame with argument GameMode.RealGame should emit a createLobby event', () => {
        const games = [
            { id: '0', title: 'Game 1', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
            { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: true, questions: [] },
        ];
        component.selectedGame = games[1];

        spyOn(gameHandler, 'getGames').and.returnValue(of(games));

        component.initializeGame(GameMode.RealGame);
        expect(gameHandler.currentGame).toEqual(games[1]);
        expect(gameHandler.gameMode).toEqual(GameMode.RealGame);
        expect(socketMock.emit).toHaveBeenCalledWith('createLobby', games[1]);
        expect(socketMock.nEmittedEvents).toEqual(++nEmittedEvents);

        component.initializeGame();
        expect(gameHandler.currentGame).toEqual(games[1]);
        expect(gameHandler.gameMode).toEqual(GameMode.RealGame);
        expect(socketMock.emit).toHaveBeenCalledWith('createLobby', games[1]);
    });

    it('initializeGame should show an alert if game is no longer visible', () => {
        const games = [
            { id: '0', title: 'Game 1', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
            { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: false, questions: [] },
        ];
        component.selectedGame = { id: '1', title: 'Game 2', description: '', duration: 0, lastModification: '', isVisible: true, questions: [] };

        const mockGetGames = spyOn(gameHandler, 'getGames').and.returnValue(of(games));

        spyOn(component['snackBar'], 'open');
        spyOn(component, 'selectRow');

        component.initializeGame(GameMode.Testing);
        expect(mockGetGames).toHaveBeenCalled();
        expect(component.games).toEqual(games);

        expect(component['snackBar'].open).toHaveBeenCalledWith(
            'Erreur: Jeu Indisponible... Rafraîchissement de page',
            '',
            SNACK_BAR_ERROR_CONFIGURATION,
        );
        expect(component.selectRow).toHaveBeenCalledWith(null);
    });
});
