import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ProfileSection } from '@app/constants/user';
import { AuthService } from '@app/services/auth/auth.service';
import { StatsService } from '@app/services/stats/stats.service';
import { Badge, Language, ProfileUpdate, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnDestroy {
    protected usernameForm: FormControl;
    protected isEditingUsername: boolean = false;
    protected activeSection: ProfileSection = ProfileSection.Profile;

    protected profileSection: ProfileSection = ProfileSection.Profile;
    protected statsSection: ProfileSection = ProfileSection.Stats;
    protected matchHistorySection: ProfileSection = ProfileSection.MatchHistory;

    protected badges: Badge[] = [];
    protected currentLanguage: string;

    private snackbar: MatSnackBar = inject(MatSnackBar);
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private authService: AuthService,
        private dialogRef: MatDialogRef<ProfileComponent>,
        private statsService: StatsService,
    ) {
        this.usernameForm = new FormControl(this.authService.user?.username, [Validators.required, this.mustBeFilled]);
        this.statsService.loadPlayerStats();
        this.badges = this.authService.user?.badges ?? [];

        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngOnDestroy(): void {
        this.statsService.resetPlayerStats();
    }

    protected getActiveSection() {
        switch (this.activeSection) {
            case ProfileSection.Profile:
                return this.currentLanguage === Language.French ? 'Profil' : 'Profile';
            case ProfileSection.Stats:
                return this.currentLanguage === Language.French ? 'Statistiques' : 'Statistics';
            case ProfileSection.MatchHistory:
                return this.currentLanguage === Language.French ? 'Historique des parties jouées' : 'Game history';
        }
    }

    protected editUsername() {
        this.isEditingUsername = true;
    }

    protected cancelEdit() {
        this.isEditingUsername = false;
        this.usernameForm.reset(this.authService.user?.username);
    }

    protected close() {
        this.dialogRef.close();
    }

    protected onSubmit() {
        const profileUpdate: ProfileUpdate = { username: this.usernameForm.value?.trim().toLowerCase() };

        this.authService.updateUsername(profileUpdate).subscribe({
            next: (user: User) => {
                this.authService.user = user;
                this.snackbar.open(
                    this.currentLanguage === Language.French ? "Nom d'utilisateur mis à jour!" : 'Username updated!',
                    '',
                    SNACK_BAR_NORMAL_CONFIGURATION,
                );
                this.cancelEdit();
                window.electron.ipcRenderer.send('user-change', user);
            },
            error: (error: HttpErrorResponse) => {
                switch (error.status) {
                    case StatusCodes.UNAUTHORIZED:
                        this.authService.redirectToLogin();
                        break;
                    case StatusCodes.CONFLICT:
                        this.usernameForm.setErrors({
                            errorMessage: this.currentLanguage === Language.French ? "Nom d'utilisateur indisponible" : 'Username unavailable',
                        });
                        break;
                    case StatusCodes.NOT_FOUND:
                        this.snackbar.open(
                            this.currentLanguage === Language.French ? 'Erreur lors de la mise à jour' : 'Unexpected error',
                            '',
                            SNACK_BAR_ERROR_CONFIGURATION,
                        );
                        break;
                }
            },
        });
    }

    protected isNewUsername() {
        return this.authService.user?.username.trim().toLowerCase() !== this.usernameForm.value.trim().toLowerCase();
    }

    protected selectSection(section: ProfileSection) {
        this.activeSection = section;

        // if (section === this.profileSection) {
        //     this.checkForGameWonBadge();
        // }
    }

    // private checkForGameWonBadge(): void {
    //     const playerStats = this.statsService.getPlayerStats();

    //     //     if (playerStats && playerStats.completedGames.some((game) => game.hasWon)) {
    //     //         this.updateBadgeProgress('game-won');
    //     //     }
    // }

    // private updateBadgeProgress(badgeId: string): void {
    //     const user = this.authService.user;
    //     if (!user) return;

    //     const badge = user.badges.find((b) => b.id === badgeId);
    //     if (badge && badge.userProgress < badge.goal) {
    //         badge.userProgress += 1;

    //         const url = `${environment.serverBaseUrl}/api/users/${user.id}/badges/${badgeId}`;
    //         this.http.patch<User>(url, { userProgress: badge.userProgress }, this.setAuthorizationHeader()).subscribe({
    //             next: (updatedUser) => {
    //                 this.authService.user = updatedUser;
    //                 this.badges = updatedUser.badges;
    //             },
    //             error: (error: HttpErrorResponse) => {
    //                 console.error('Erreur lors de la mise à jour du badge:', error);
    //             },
    //         });
    //     }
    // }

    // private setAuthorizationHeader() {
    //     const token = sessionStorage.getItem(TOKEN);
    //     const headers = new HttpHeaders({
    //         // eslint-disable-next-line @typescript-eslint/naming-convention
    //         Authorization: `Bearer ${token}`,
    //     });

    //     return { headers };
    // }

    private mustBeFilled(formControl: AbstractControl) {
        const isUsernameFilled = formControl.value.trim() !== '';
        if (isUsernameFilled) return null; // Valid, no errors
        return { notFilled: true }; // Invalid, error object
    }
}
