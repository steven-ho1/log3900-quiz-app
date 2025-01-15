import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { ErrorMessage } from '@app/constants/error-message';
import { BASIC_CONSOLATION_PRIZE, BASIC_VICTORY_PRIZE } from '@app/constants/in-game';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { TimerService } from '@app/services/timer/timer.service';
import { LobbyDetails, Pin, Player, SocketId } from '@common/lobby';
import { Challenge } from '@common/stats';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import * as QRCode from 'qrcode';

const GAME_START_INITIAL_COUNT = 5;

@Component({
    selector: 'app-lobby-page',
    templateUrl: './lobby-page.component.html',
    styleUrls: ['./lobby-page.component.scss'],
})
export class LobbyPageComponent implements OnInit, OnDestroy {
    protected challenge: Challenge | null;
    protected lobby: LobbyDetails;
    protected qrCodeDataUrl: string | null = null;
    protected lightBackgroundImage;
    protected darkBackgroundImage;
    protected players: Player[] = [];
    protected isLocked: boolean = false;
    protected started: boolean = false;
    protected gameStarted: boolean = false;
    protected countdownStarted: boolean = false;
    protected gameId: string = '';
    protected basicVictoryPrize: number = BASIC_VICTORY_PRIZE;
    protected basicConsolationPrize: number = BASIC_CONSOLATION_PRIZE;
    protected entryFee: number = 0;
    protected entryFeeVictoryPrize: number = 0;
    protected entryFeeConsolationPrize: number = 0;
    protected currentLanguage: string;
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private routeController: RouteControllerService = inject(RouteControllerService);
    private timer: TimerService = inject(TimerService);

    // eslint-disable-next-line max-params
    constructor(
        private router: Router,
        private clientSocket: ClientSocketService,
        private authService: AuthService,
        private gameHandler: GameHandlingService,
        private translate: TranslateService,
    ) {
        this.lightBackgroundImage = this.authService.getBackgroundImage();
        this.darkBackgroundImage = this.authService.getBackgroundImage(true);

        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

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

    get wallet() {
        return this.authService.user?.wallet;
    }

    ngOnInit(): void {
        this.configureBaseSocketFeatures();
        this.clientSocket.socket.emit('getPlayers');
        this.generateQRCode(this.clientSocket.pin);
        this.getChallenge();
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('latestPlayerList');
        this.clientSocket.socket.removeAllListeners('lockToggled');
        this.clientSocket.socket.removeAllListeners('countdownEnd');
        this.clientSocket.socket.removeAllListeners('noPlayers');

        this.timer.reset();
        this.routeController.setRouteAccess(Route.Lobby, false);
        if (this.gameStarted) return;
        this.gameHandler.resetInGameData();
        this.clientSocket.resetPlayerInfo();
    }
    // Setup des listeners de base
    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('latestPlayerList', (lobbyDetails: LobbyDetails) => {
            this.lobby = lobbyDetails;
            this.entryFee = lobbyDetails.entryFee;
            this.entryFeeVictoryPrize = (lobbyDetails.entryFeeSum * 2) / 3;
            this.entryFeeConsolationPrize = lobbyDetails.entryFeeSum / 3;
            this.isLocked = lobbyDetails.isLocked;
            this.started = lobbyDetails.started;
            this.players = lobbyDetails.players;
            if (this.gameId) {
                this.gameId = lobbyDetails.game ? lobbyDetails.game.id : '';
            }
        });

        this.clientSocket.socket.on('lockToggled', (isLocked: boolean) => {
            this.isLocked = isLocked;
        });
        this.clientSocket.socket.on('lobbyStarted', (started: boolean) => {
            this.started = started;
        });

        this.clientSocket.socket.on('countdownEnd', () => {
            this.toggleLobbyStart();
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

    getAvatarImage(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }

    banPlayer(player: { socketId: SocketId; name: string }) {
        this.clientSocket.socket.emit('banPlayer', player);
    }

    toggleLobbyLock() {
        this.clientSocket.socket.emit('toggleLock');
    }
    toggleLobbyStart() {
        this.clientSocket.socket.emit('lobbyStart');
    }

    startGameEmit() {
        this.countdownStarted = true;
        this.timer.startCountdown(GAME_START_INITIAL_COUNT);
    }

    // Debuter la partie avec les autres joueurs
    startGame() {
        if (this.gameHandler.getCurrentGamePublicState(this.gameId)) {
            this.clientSocket.socket.emit('gameStarted');
            if (this.clientSocket.playerName) {
                this.gameStarted = true;
                this.gameHandler.totalVictoryPrize = this.basicVictoryPrize + this.entryFeeVictoryPrize;
                this.routeController.setRouteAccess(Route.InGame, true);
                this.router.navigate([Route.InGame]);
                this.clientSocket.players = this.players;
                return;
            }
            this.router.navigate([Route.MainMenu]);
            this.snackBar.open(ErrorMessage.PlayerNameUndefinedError, '', SNACK_BAR_ERROR_CONFIGURATION);
        }
        this.router.navigate([Route.MainMenu]);
        this.snackBar.open(ErrorMessage.VisibilityChange, '', SNACK_BAR_ERROR_CONFIGURATION);
    }

    notifyClipboardCopy() {
        this.snackBar.open('PIN copié!', '', SNACK_BAR_NORMAL_CONFIGURATION);
    }

    generateQRCode(pin: string) {
        QRCode.toDataURL(pin, (err, url) => {
            if (err) {
                // console.error('Error generating QR code', err);
                return;
            }
            this.qrCodeDataUrl = url;
        });
    }

    toggleMute(player: Player) {
        player.isAbleToChat = !player.isAbleToChat;
        this.clientSocket.socket.emit('toggleMute', player);
    }

    getChallenge() {
        this.gameHandler.getChallenge().subscribe({
            next: (challenge: Challenge) => {
                this.challenge = challenge;
                this.gameHandler.challenge = challenge;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) {
                    this.authService.redirectToLogin();
                } else if (error.status === StatusCodes.NOT_FOUND) {
                    this.challenge = null;
                }
            },
        });
    }
}
