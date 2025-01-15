import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BlockedPlayerWarningComponent } from '@app/components/blocked-player-warning/blocked-player-warning.component';
import { USERNAME } from '@app/constants/auth';
import { Route } from '@app/constants/enums';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { LobbyDetails, Pin, Player, REQUIRED_PIN_LENGTH } from '@common/lobby';
import { User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-hub-pick',
    templateUrl: './hub-pick.component.html',
    styleUrls: ['./hub-pick.component.scss'],
})
export class HubPickComponent implements OnInit, OnDestroy {
    backgroundImage;
    pinForm: FormGroup;
    lobbies: LobbyDetails[] = [];
    isLoading: boolean = true;
    fileName: string = '';
    isFileEmpty: boolean = false;
    isFormInvalid: boolean = false;
    serverErrorMessage: string = '';
    username: string = '';
    protected currentLanguage: string;
    private authService: AuthService = inject(AuthService);
    private routeController: RouteControllerService = inject(RouteControllerService);
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private router: Router = inject(Router);
    private dialog: MatDialog = inject(MatDialog);

    constructor(
        private gameHandler: GameHandlingService,
        private readonly clientSocket: ClientSocketService,
        private readonly translate: TranslateService,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        const fb: FormBuilder = new FormBuilder();
        this.pinForm = fb.group({
            pin: ['', [Validators.required, Validators.minLength(REQUIRED_PIN_LENGTH), this.containsNonNumeric]],
        });
        this.configureBaseSocketFeatures();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });

        this.clientSocket.resetPlayerInfo();
    }

    get wallet() {
        return this.authService.user?.wallet;
    }

    ngOnInit(): void {
        this.username = sessionStorage.getItem(USERNAME) || 'Joueur';
        this.clientSocket.socket.emit('getActiveLobbies');
    }
    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('validPin');
        this.clientSocket.socket.removeAllListeners('invalidPin');
        this.clientSocket.socket.removeAllListeners('lobbyList');
        this.clientSocket.socket.removeAllListeners('Not enough cash, stranger!');
        this.clientSocket.socket.removeAllListeners('blockedUserWarning');
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('validPin', (lobby: LobbyDetails, pin: Pin, user: User) => {
            this.authService.user = user;
            this.routeController.setRouteAccess(Route.Lobby, true);
            this.gameHandler.gameMode = GameMode.RealGame;
            this.clientSocket.pin = pin;
            this.gameHandler.currentGame = lobby.game as Game;
            this.clientSocket.playerName = this.username.toLowerCase();

            const player = lobby.players.find((p: Player) => p.socketId === this.clientSocket.socket.id);

            if (player?.role === 'observer') {
                this.routeController.setRouteAccess(Route.InGame, true);
                this.router.navigate([Route.InGame], { queryParams: { observer: true, pin } });
            } else {
                this.router.navigate([Route.Lobby]);
            }
        });

        this.clientSocket.socket.on('invalidPin', (message: string) => {
            this.serverErrorMessage = message;
        });

        this.clientSocket.socket.on('lobbyList', (receivedLobbies: LobbyDetails[]) => {
            this.lobbies = receivedLobbies;
            this.isLoading = false;
        });

        this.clientSocket.socket.on('Not enough cash, stranger!', () => {
            this.snackBar.open('Montant insuffisant', '', SNACK_BAR_ERROR_CONFIGURATION);
        });

        this.clientSocket.socket.on('blockedUserWarning', (data: { message: string; pin: string }) => {
            this.handleBlockedWarning(data.message, data.pin);
        });
    }

    handleBlockedWarning(message: string, pin: string): void {
        const dialogRef = this.dialog.open(BlockedPlayerWarningComponent, {
            width: '19%',
            height: '25%',
            backdropClass: 'backdropBackground',
            data: { message },
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                this.clientSocket.socket.emit('confirmJoin', {
                    username: this.username.toLowerCase(),
                    avatar: this.authService.user?.avatar,
                    pinToJoin: pin,
                });
            }
        });
    }

    isGameInList(game: Game): boolean {
        for (const g of this.lobbies) {
            if (g.game?.title === game.title) {
                return true;
            }
        }
        return false;
    }

    // Controle des caracteres du PIN entry
    containsNonNumeric(control: AbstractControl): null | { containsNonNumeric: boolean } {
        return /^\d+$/.test(control.value) ? null : { containsNonNumeric: true };
    }

    // Controle des caracteres du PIN entry
    pinContainsNonNumeric(): boolean {
        return this.pinForm.controls['pin'].dirty && this.pinForm.invalid;
    }

    joinGame(lobby: LobbyDetails): void {
        if (this.clientSocket.socket.connected) {
            this.clientSocket.socket.emit('validatePin', {
                username: this.username.toLowerCase(),
                avatar: this.authService.user?.avatar,
                pinToJoin: lobby.pin,
            });
        } else this.snackBar.open(ErrorMessage.NetworkError, '', SNACK_BAR_ERROR_CONFIGURATION);
    }

    onSubmit(): void {
        if (this.clientSocket.socket.connected)
            this.clientSocket.socket.emit('validatePin', {
                username: this.username.toLowerCase(),
                avatar: this.authService.user?.avatar,
                pinToJoin: this.pinForm.value.pin,
            });
        else this.snackBar.open(ErrorMessage.NetworkError, '', SNACK_BAR_ERROR_CONFIGURATION);
    }

    observeGame(lobby: LobbyDetails): void {
        if (lobby.started) {
            this.clientSocket.socket.emit('joinAsObserver', { username: this.username.toLowerCase(), pinToJoin: lobby.pin });
        }
    }
    getObserverCount(lobby: LobbyDetails): number {
        return lobby.players.filter((player) => player.role === 'observer').length;
    }
    getPlayerCount(lobby: LobbyDetails): number {
        return lobby.players.filter((player) => player.role !== 'observer').length;
    }
}
