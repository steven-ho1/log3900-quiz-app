/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { GameImportPopupComponent } from '@app/components/game-import-popup/game-import-popup.component';
import { ViewCommentsDialogComponent } from '@app/components/view-comments-dialog/view-comments-dialog.component';
import { TOKEN, USERNAME } from '@app/constants/auth';
import { Route } from '@app/constants/enums';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Choice, Feedback, Game, Question, QuestionType } from '@common/game';
import { Limit } from '@common/limit';
import { Badge, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { saveAs } from 'file-saver-es';
import { StatusCodes } from 'http-status-codes';
import { finalize } from 'rxjs';
import { environment } from 'src/environments/environment';

const JSON_SPACE = 4;

@Component({
    selector: 'app-admin-jeu-page',
    templateUrl: './admin-jeu-page.component.html',
    styleUrls: ['./admin-jeu-page.component.scss'],
})
export class AdminJeuPageComponent implements OnInit {
    backgroundImage;
    quizCreationRoute: string = '/' + Route.QuizCreation;
    historyRoute: string = '/' + Route.HistoryPage;
    games: Game[];
    filteredGames: Game[];
    badges: Badge[] = [];
    isLoading: boolean = true;
    fileName: string = '';
    isFileEmpty: boolean = false;
    isFormInvalid: boolean = false;
    username: string = '';
    protected currentLanguage: string;
    private dialog: MatDialog = inject(MatDialog);
    private authService: AuthService = inject(AuthService);
    private readonly router: Router = inject(Router);
    private readonly translate: TranslateService = inject(TranslateService);
    private http: HttpClient = inject(HttpClient);

    constructor(
        private gameHandler: GameHandlingService,
        private formManager: FormManagerService,
        private snackBar: MatSnackBar,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngOnInit(): void {
        this.badges = this.authService.user?.badges ?? [];
        this.username = sessionStorage.getItem(USERNAME) || 'Joueur';
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
                    this.filterGames(games);
                },
                error: (error: HttpErrorResponse) => {
                    if (error.status === StatusCodes.NOT_FOUND) {
                        this.snackBar.open(ErrorMessage.GamesNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                    }
                },
            });
    }
    isCreator(game: Game): boolean {
        return this.authService.user?.username === game.creator;
    }

    // Liste de jeu visible par chaque utilisateur ( Jeux publics + jeux dont le créateur est l'utilisateur actuel)
    filterGames(games: Game[]): void {
        this.filteredGames = games.filter((game) => game.isPublic || (game.creator === this.username && !game.isPublic));
    }

    modifyGame(game: Game): void {
        this.gameHandler.getGames().subscribe({
            next: (games) => {
                this.games = games;
                if (!this.isGameInList(game)) {
                    this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                } else {
                    if (!game.isPublic && this.username !== game.creator) {
                        this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                        return;
                    }
                    const fb = new FormBuilder();
                    const gameForm: FormGroup = fb.group({
                        id: game.id,
                        title: [game.title, Validators.required],
                        description: [game.description, Validators.required],
                        duration: [game.duration, Validators.required],
                        lastModification: game.lastModification,
                        isVisible: game.isVisible,
                        questions: fb.array(
                            game.questions.map((question: Question) => {
                                const questionForm: FormGroup = fb.group({
                                    text: [question.text, [Validators.required, this.formManager.preventEmptyInput]],
                                    points: [
                                        question.points,
                                        [Validators.required, Validators.pattern('^[1-9][0-9]*0$'), Validators.max(Limit.MaxPoints)],
                                    ],
                                    type: question.type,
                                    qstImage: fb.group({
                                        data: [question.qstImage?.data || null], // Use null if qstImage is undefined
                                        name: [question.qstImage?.name || null], // Use empty string if qstImage is undefined
                                    }),
                                });
                                if (question.type === QuestionType.QCM) {
                                    if (question.choices) {
                                        const choices = fb.array(
                                            question.choices.map((choice: Choice) => {
                                                return fb.group({
                                                    text: [choice.text, [Validators.required, this.formManager.preventEmptyInput]],
                                                    isCorrect: choice.isCorrect,
                                                });
                                            }),
                                        ) as FormArray;

                                        questionForm.addControl('choices', choices);
                                    }
                                }
                                if (question.type === QuestionType.QRE) {
                                    questionForm.addControl('correctSlideAnswer', fb.control(question.correctSlideAnswer, Validators.required));

                                    questionForm.addControl('lowerBound', fb.control(question.lowerBound, Validators.required));

                                    questionForm.addControl('upperBound', fb.control(question.upperBound, Validators.required));

                                    questionForm.addControl('toleranceMargin', fb.control(question.toleranceMargin, Validators.required));
                                }
                                return questionForm;
                            }),
                        ),
                        isPublic: game.isPublic ?? true,
                        creator: game.creator ?? this.username,
                    });
                    this.formManager.gameForm = gameForm;
                    this.formManager.nameModif = game.title;
                    this.router.navigate([Route.QuizCreation]);
                }
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GamesNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    exportGame(i: string): void {
        this.gameHandler.export(i).subscribe({
            next: (data) => {
                console.log(data);
                const file = new Blob([JSON.stringify(data, null, JSON_SPACE)], { type: 'application/json' });
                const downloadURL = window.URL.createObjectURL(file);
                saveAs(downloadURL, `Game_${i}.json`);
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    toggleVisibility(game: Game): void {
        const toggledVisibility = !game.isVisible;

        this.gameHandler.changeVisibility({ ...game, isVisible: toggledVisibility }).subscribe({
            next: () => {
                game.isVisible = toggledVisibility;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.BAD_REQUEST) {
                    this.snackBar.open(ErrorMessage.InvalidRequest, '', SNACK_BAR_ERROR_CONFIGURATION);
                } else if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    togglePublicState(game: Game): void {
        if (this.username !== game.creator) {
            this.snackBar.open(ErrorMessage.NotCreator, '', SNACK_BAR_ERROR_CONFIGURATION);
            return;
        }
        const toggledPublicState = !game.isPublic;

        this.gameHandler.changePublicState({ ...game, isPublic: toggledPublicState }).subscribe({
            next: () => {
                game.isPublic = toggledPublicState;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.BAD_REQUEST) {
                    this.snackBar.open(ErrorMessage.InvalidRequest, '', SNACK_BAR_ERROR_CONFIGURATION);
                } else if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    isGameInList(game: Game): boolean {
        this.filterGames(this.games);
        for (const g of this.filteredGames) {
            if (g.title === game.title) {
                return true;
            }
        }
        return false;
    }

    confirmDeletion(game: Game): void {
        const confirmation = window.confirm('Are you sure you want to delete this game?');
        if (confirmation) {
            if (!this.isGameInList(game)) {
                this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
            } else {
                this.gameHandler.deleteGame(game.id).subscribe({
                    next: () => {
                        this.games = this.games.filter((g) => g.id !== game.id);
                        this.filterGames(this.games);
                    },
                    error: (error: HttpErrorResponse) => {
                        if (error.status === StatusCodes.NOT_FOUND) {
                            this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                        }
                    },
                });
            }
        }
    }

    deleteGame(game: Game): void {
        this.gameHandler.getGames().subscribe({
            next: (games) => {
                this.games = games;
                if (!this.isGameInList(game)) {
                    this.snackBar.open(ErrorMessage.GameNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                } else {
                    this.confirmDeletion(game);
                }
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GamesNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    importGame($event: Event): void {
        const gameFiles: FileList | null = ($event.target as HTMLInputElement).files;

        if (gameFiles != null) {
            const gameFile: File = gameFiles[0];
            this.readFile(gameFile);
        }
        ($event.target as HTMLInputElement).value = '';
    }

    readFile(gameFile: File): void {
        const fileReader = new FileReader();
        fileReader.onload = () => {
            try {
                const importedGame: string = fileReader.result as string;

                if (importedGame !== undefined && importedGame.trim().length !== 0) {
                    this.isFileEmpty = false;
                    this.isFormInvalid = false;
                    this.openImportPopup(JSON.parse(importedGame));
                } else {
                    this.isFileEmpty = true;
                    this.isFormInvalid = false;
                }
            } catch {
                this.isFormInvalid = true;
                this.isFileEmpty = false;
            }
        };
        this.fileName = gameFile.name;
        fileReader.readAsText(gameFile);
    }

    openImportPopup(importedGame: Game) {
        if (importedGame.isPublic === undefined) {
            importedGame.isPublic = true;
        }
        importedGame.creator = this.username;
        const fileName: string = this.fileName;
        const games: Game[] = this.games;
        const importPopup: MatDialogRef<GameImportPopupComponent> = this.dialog.open(GameImportPopupComponent, {
            data: { importedGame, games, fileName },
            width: '60%',
            height: '70%',
            backdropClass: 'backdropBackground',
            disableClose: true,
        });

        importPopup.afterClosed().subscribe({
            next: (newGames: Game[]) => {
                if (newGames !== undefined) {
                    this.games = newGames;
                    this.filterGames(newGames);
                    this.updateBadgeProgress('game-import');
                }
            },
            error: () => {
                return;
            },
        });
    }

    // Affichage des noms des créateurs et des titres
    capitalizeFirstLetter(name: string): string {
        if (!name) return ''; // Vérifie si le nom est vide ou undefined
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    calculateAverageRating(game: Game): number {
        if (!game.feedback || game.feedback.length === 0) {
            return 0; // Aucun feedback n'a été donné
        }
        const totalRating = game.feedback.reduce((sum, feedback) => sum + feedback.rating, 0);
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        return Math.round((totalRating / game.feedback.length) * 10) / 10; // Arrondir à une décimale
    }
    viewComments(game: Game): void {
        const dialogRef = this.dialog.open(ViewCommentsDialogComponent, {
            data: { game, isAdmin: true },
            width: '600px',
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result && result.updatedGame) {
                this.updateGameComments(game.id, result.updatedGame.feedback);
            }
        });
    }

    updateGameComments(gameId: string, updatedComments: Feedback[]): void {
        this.gameHandler.updateGame(gameId, { feedback: updatedComments }).subscribe({
            // next: () => {
            //     console.log('Commentaires mis à jour avec succès');
            // },
            // error: (error: HttpErrorResponse) => {
            //     console.error('Erreur lors de la mise à jour des commentaires:', error);
            // },
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
