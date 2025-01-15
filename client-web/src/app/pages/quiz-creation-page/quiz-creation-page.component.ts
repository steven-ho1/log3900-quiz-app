/* eslint-disable no-console */
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TOKEN, USERNAME } from '@app/constants/auth';
import { Route } from '@app/constants/enums';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game } from '@common/game';
import { Limit } from '@common/limit';
import { Badge, Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-quiz-creation-page',
    templateUrl: './quiz-creation-page.component.html',
    styleUrls: ['./quiz-creation-page.component.scss'],
})
export class QuizCreationPageComponent implements OnInit, OnDestroy {
    backgroundImage;
    adminRoute: string = '/' + Route.Admin;
    pageTitle: string;
    maxTitleLength: number;
    maxDescriptionLength: number;
    isNameDuplicate = false;
    isNameEmpty = false;
    isDescEmpty = false;
    isTimerInvalid = false;
    games: Game[];
    badges: Badge[] = [];
    gameForm: FormGroup = this.formManager.gameForm;
    nameModif: string;
    isAccessingQuestionCreation = false;
    username: string = sessionStorage.getItem(USERNAME) || 'Joueur';
    currentLanguage: string;
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private authService: AuthService = inject(AuthService);
    private http: HttpClient = inject(HttpClient);
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private gameHandler: GameHandlingService,
        private formManager: FormManagerService,
        private router: Router,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        this.maxTitleLength = Limit.MaxTitleLength;
        this.maxDescriptionLength = Limit.MaxDescriptionLength;
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
        this.pageTitle = this.currentLanguage === Language.French ? "Création d'un jeu" : 'Quiz creation';
    }

    get creatorFormValue(): string {
        return this.gameForm.get('creator')?.value;
    }

    ngOnInit(): void {
        this.badges = this.authService.user?.badges ?? [];
        this.nameModif = this.formManager.nameModif;
        this.gameHandler.getGames().subscribe({
            next: (games) => {
                this.games = games;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(ErrorMessage.GamesNotFound, '', SNACK_BAR_ERROR_CONFIGURATION);
                }
            },
        });
    }

    ngOnDestroy(): void {
        if (this.isAccessingQuestionCreation) return;
        this.formManager.resetGameForm();
    }

    // Verification des requis pour un quiz

    verifyName(event: Event): void {
        this.isNameEmpty = !(event.target as HTMLInputElement).value.trim();

        if ((event.target as HTMLInputElement).value.trim().toLowerCase() === this.nameModif.toLowerCase() && !this.isNameEmpty) {
            this.isNameDuplicate = false;
            return;
        }
        this.verifyNameDuplicate((event.target as HTMLInputElement).value);
    }

    verifyNameDuplicate(name: string): void {
        for (const game of this.games) {
            this.isNameDuplicate = game.title.toLowerCase() === name.trim().toLowerCase();
            if (this.isNameDuplicate) return;
        }
    }

    verifyDesc(event: Event) {
        this.isDescEmpty = !(event.target as HTMLInputElement).value.trim();
    }

    verifyTimer(event: Event) {
        this.isTimerInvalid =
            !(event.target as HTMLInputElement).value.trim() ||
            Number((event.target as HTMLInputElement).value) < Limit.MinDuration ||
            Number((event.target as HTMLInputElement).value) > Limit.MaxDuration;
    }

    hasQuestions(): boolean {
        return this.formManager.hasQuestions();
    }

    accessQuestionCreation(): void {
        this.isAccessingQuestionCreation = true;
        this.router.navigate([Route.QuestionCreation]);
    }

    togglePublicState() {
        const currentState = this.gameForm.get('isPublic')?.value;
        this.gameForm.patchValue({ isPublic: !currentState });
    }

    onSubmit(): void {
        if (!this.creatorFormValue) {
            this.gameForm.patchValue({ creator: this.username });
        }
        this.formManager.sendGameForm();
        this.updateBadgeProgress('game-add');
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
