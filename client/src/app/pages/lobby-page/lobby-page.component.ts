import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { TimerService } from '@app/services/timer/timer.service';
import { LobbyDetails, Pin, Player, SocketId } from '@common/lobby';

const GAME_START_INITIAL_COUNT = 5;

@Component({
    selector: 'app-lobby-page',
    templateUrl: './lobby-page.component.html',
    styleUrls: ['./lobby-page.component.scss'],
})
export class LobbyPageComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    isLocked: boolean = false;
    gameStarted: boolean = false;
    countdownStarted: boolean = false;
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private routeController: RouteControllerService = inject(RouteControllerService);
    private timer: TimerService = inject(TimerService);

    constructor(
        private router: Router,
        private clientSocket: ClientSocketService,
    ) {}

    get isOrganizer(): boolean {
        return this.clientSocket.isOrganizer;
    }

    get playerName(): string {
        return this.clientSocket.playerName;
    }

    get pin(): Pin {
        return this.clientSocket.pin;
    }

    get count(): number {
        return this.timer.count;
    }

    ngOnInit(): void {
        this.configureBaseSocketFeatures();
        this.clientSocket.socket.emit('getPlayers');
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('latestPlayerList');
        this.clientSocket.socket.removeAllListeners('lockToggled');
        this.clientSocket.socket.removeAllListeners('countdownEnd');
        this.clientSocket.socket.removeAllListeners('noPlayers');

        this.timer.reset();
        this.routeController.setRouteAccess(Route.Lobby, false);
        if (this.gameStarted) return;
        this.clientSocket.resetPlayerInfo();
    }
    // Setup des listeners de base
    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('latestPlayerList', (lobbyDetails: LobbyDetails) => {
            this.isLocked = lobbyDetails.isLocked;
            this.players = lobbyDetails.players;
        });

        this.clientSocket.socket.on('lockToggled', (isLocked: boolean) => {
            this.isLocked = isLocked;
        });

        this.clientSocket.socket.on('countdownEnd', () => {
            this.startGame();
        });

        this.clientSocket.socket.on('noPlayers', () => {
            if (this.countdownStarted) {
                this.timer.reset();
                this.countdownStarted = false;
                this.toggleLobbyLock();
                this.snackBar.open("Tous les joueurs ont quitté la salle d'attente", '', SNACK_BAR_ERROR_CONFIGURATION);
            }
        });
    }

    banPlayer(player: { socketId: SocketId; name: string }) {
        this.clientSocket.socket.emit('banPlayer', player);
    }

    toggleLobbyLock() {
        this.clientSocket.socket.emit('toggleLock');
    }

    startGameEmit() {
        this.countdownStarted = true;
        this.timer.startCountdown(GAME_START_INITIAL_COUNT);
    }
    // Debuter la partie avec les autres joueurs
    startGame() {
        this.clientSocket.socket.emit('gameStarted');
        if (this.clientSocket.playerName) {
            this.gameStarted = true;
            this.routeController.setRouteAccess(Route.InGame, true);
            this.router.navigate([Route.InGame]);
            this.clientSocket.players = this.players;
            return;
        }
        this.router.navigate([Route.MainMenu]);
        this.snackBar.open("Votre nom de joueur n'a pas été défini avant le début de la partie", '', SNACK_BAR_ERROR_CONFIGURATION);
    }

    notifyClipboardCopy() {
        this.snackBar.open('PIN copié!', '', SNACK_BAR_NORMAL_CONFIGURATION);
    }

    toggleMute(player: Player) {
        player.isAbleToChat = !player.isAbleToChat;
        this.clientSocket.socket.emit('toggleMute', player);
    }
}
