import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

@Component({
    selector: 'app-duolingo',
    templateUrl: './duolingo.component.html',
    styleUrls: ['./duolingo.component.scss'],
})
export class DuolingoComponent {
    protected selectedLanguage;
    protected french: Language = Language.French;
    protected english: Language = Language.English;

    constructor(
        private translate: TranslateService,
        private authService: AuthService,
    ) {
        this.selectedLanguage = this.translate.currentLang;
        if (this.authService.isAuthenticated) this.selectedLanguage = this.authService.user?.settings.languagePreference as string;
        else this.selectedLanguage = this.translate.currentLang;
    }

    switchLanguage(language: string) {
        this.translate.use(language);

        if (this.authService.isAuthenticated) {
            this.authService.updateSettings({ languagePreference: language as Language }).subscribe({
                next: (user: User) => {
                    this.authService.user = user;
                },
                error: (error: HttpErrorResponse) => {
                    if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
                    // Pas envie de gérer les autres erreurs
                },
            });
        }
    }
}
