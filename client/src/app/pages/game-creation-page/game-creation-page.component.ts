import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Pin } from '@common/lobby';

@Component({
    selector: 'app-game-creation-page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
})
export class GameCreationPageComponent implements OnInit, OnDestroy {
    games: Game[];
    selectedRowIndex: number | null = null;
    selectedGame: Game | null = null;
    testing: GameMode = GameMode.Testing;
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private routeController: RouteControllerService = inject(RouteControllerService);
    constructor(
        public router: Router,
        private gameHandler: GameHandlingService,
        private clientSocket: ClientSocketService,
    ) {}

    ngOnInit(): void {
        this.routeController.setRouteAccess(Route.Admin, false);
        this.gameHandler.getGames().subscribe((games: Game[]) => {
            this.games = games;
        });
        this.configureBaseSocketFeatures();
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('successfulLobbyCreation');
        this.clientSocket.socket.removeAllListeners('failedLobbyCreation');
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('successfulLobbyCreation', (pin: Pin) => {
            this.clientSocket.giveOrganiserPermissions();
            this.clientSocket.pin = pin;
            this.routeController.setRouteAccess(Route.Lobby, true);
            this.router.navigate([Route.Lobby]);
        });

        this.clientSocket.socket.on('failedLobbyCreation', (reason) => {
            this.snackBar.open(reason, '', SNACK_BAR_ERROR_CONFIGURATION);
        });
    }

    selectRow(index: number | null) {
        this.selectedRowIndex = index;
        this.selectedGame = index !== null ? this.games[index] : null;
    }

    allGamesAreHiddenOrListIsEmpty() {
        if (!this.games || this.games.length === 0) {
            return true;
        }
        return this.games.every((game) => !game.isVisible);
    }
    // Creation d'une partie test ou multijoueur
    initializeGame(mode: GameMode = GameMode.RealGame) {
        this.gameHandler.getGames().subscribe((games: Game[]) => {
            this.games = games;

            for (const game of this.games) {
                if (game.id === this.selectedGame?.id && game.isVisible) {
                    this.gameHandler.currentGame = game;
                    this.gameHandler.gameMode = mode;
                    if (mode === GameMode.Testing) {
                        this.clientSocket.playerName = 'Testeur';
                        this.routeController.setRouteAccess(Route.InGame, true);
                        this.router.navigate([mode]);
                    } else this.clientSocket.socket.emit('createLobby', this.gameHandler.currentGame);
                    return;
                }
            }

            this.snackBar.open('Erreur: Jeu Indisponible... Rafraîchissement de page', '', SNACK_BAR_ERROR_CONFIGURATION);
            this.selectRow(null);
        });
    }
}
