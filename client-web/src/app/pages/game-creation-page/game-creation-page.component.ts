/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable no-console */
/* eslint-disable max-params */
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ViewCommentsDialogComponent } from '@app/components/view-comments-dialog/view-comments-dialog.component';
import { TOKEN, USERNAME } from '@app/constants/auth';
import { Route } from '@app/constants/enums';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';
import { Game } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Pin } from '@common/lobby';
import { Badge, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { finalize } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

const FEE_LIMIT = 999999999;

@Component({
    selector: 'app-game-creation-page',
    templateUrl: './game-creation-page.component.html',
    styleUrls: ['./game-creation-page.component.scss'],
})
export class GameCreationPageComponent implements OnInit, OnDestroy {
    backgroundImage;
    games: Game[];
    selectedRowIndex: number | null = null;
    selectedGame: Game | null = null;
    testing: GameMode = GameMode.Testing;
    isLoading: boolean = true;
    username: string = sessionStorage.getItem(USERNAME) || 'Joueur';
    entryFee: number = 0;
    feeLimit: number = FEE_LIMIT;
    badges: Badge[] = [];
    currentLanguage: string;
    isFriendsOnly: boolean = false;
    pressed: boolean = false;

    private snackBar: MatSnackBar = inject(MatSnackBar);
    private routeController: RouteControllerService = inject(RouteControllerService);
    private router: Router = inject(Router);
    private http: HttpClient = inject(HttpClient);

    constructor(
        private gameHandler: GameHandlingService,
        private clientSocket: ClientSocketService,
        private authService: AuthService,
        private dialog: MatDialog,
        private translate: TranslateService,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngOnInit(): void {
        this.badges = this.authService.user?.badges ?? [];
        this.routeController.setRouteAccess(Route.Admin, false);
        this.gameHandler
            .getGames()
            .pipe(
                finalize(() => {
                    this.isLoading = false; // Called on both success and error
                }),
            )
            .subscribe({
                next: (games: Game[]) => {
                    this.games = games;
                },
                error: (error: HttpErrorResponse) => {
                    if (error.status === StatusCodes.NOT_FOUND) {
                        this.snackBar.open(ErrorMessage.GamesNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                    }
                },
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
            this.updateBadgeProgress('game-create');
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
        this.gameHandler.getGames().subscribe({
            next: (games: Game[]) => {
                this.games = games;

                for (const game of this.games) {
                    if (
                        game.id === this.selectedGame?.id &&
                        game.isVisible &&
                        (game.isPublic || (!game.isPublic && game.creator === this.username))
                    ) {
                        this.gameHandler.currentGame = game;
                        this.gameHandler.gameMode = mode;
                        if (mode === GameMode.Testing) {
                            this.clientSocket.playerName = 'Testeur';
                            this.routeController.setRouteAccess(Route.InGame, true);
                            this.router.navigate([mode]);
                        } else this.clientSocket.socket.emit('createLobby', this.gameHandler.currentGame, this.entryFee, this.isFriendsOnly);
                        return;
                    }
                }

                this.snackBar.open(ErrorMessage.GameUnavailable, '', SNACK_BAR_ERROR_CONFIGURATION);
                this.selectRow(null);
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GamesNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    ensureFeeLimit() {
        if (this.entryFee > this.feeLimit) this.entryFee = this.feeLimit;
        else if (this.entryFee < 0) this.entryFee = 0;
    }

    isEntryFeeNumber() {
        return typeof this.entryFee === 'number' && this.entryFee <= this.feeLimit && this.entryFee >= 0;
    }

    togglePartyState() {
        this.isFriendsOnly = !this.isFriendsOnly;
    }

    calculateAverageRating(game: Game): number {
        if (!game.feedback || game.feedback.length === 0) {
            return 0;
        }

        const totalRating = game.feedback.reduce((acc, feedback) => acc + feedback.rating, 0);
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        return Math.round((totalRating / game.feedback.length) * 10) / 10;
    }
    viewComments(game: Game): void {
        this.dialog
            .open(ViewCommentsDialogComponent, {
                width: '600px',
                data: { game, isAdmin: false },
            })
            .afterClosed()
            .subscribe((result) => {
                if (result && result.updatedGame) {
                    const updatedGameIndex = this.games.findIndex((g) => g.id === result.updatedGame.id);
                    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                    if (updatedGameIndex > -1) {
                        this.games[updatedGameIndex] = result.updatedGame;
                    }
                }
            });
    }

    private setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }
    private updateBadgeProgress(badgeId: string): void {
        const user = this.authService.user;
        if (!user) return;

        const badge = user.badges.find((b) => b.id === badgeId);
        if (badge && badge.userProgress < badge.goal) {
            badge.userProgress += 1;

            const url = `${environment.serverBaseUrl}/api/users/${user.id}/badges/${badgeId}`;
            this.http.patch<User>(url, { userProgress: badge.userProgress }, this.setAuthorizationHeader()).subscribe({
                next: (updatedUser) => {
                    this.authService.user = updatedUser;
                    this.badges = updatedUser.badges;
                },
                // error: (error: HttpErrorResponse) => {
                //     console.error('Erreur lors de la mise à jour du badge:', error);
                // },
            });
        }
    }
}
