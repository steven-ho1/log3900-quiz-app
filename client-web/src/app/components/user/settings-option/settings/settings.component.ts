import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION, SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { SettingSection } from '@app/constants/user';
import { AuthService } from '@app/services/auth/auth.service';
import { Item, ItemType } from '@common/item';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
})
export class SettingsComponent implements OnInit {
    protected activeSection: SettingSection = SettingSection.Theme;
    protected themeSection: SettingSection = SettingSection.Theme;
    protected authLogsSection: SettingSection = SettingSection.AuthLogs;
    protected selectedTheme: string;
    protected themes: Item[] = [];
    protected currentLanguage: string;
    protected emailForm: FormControl;
    protected isEditingEmail: boolean = false;
    private originalEmail: string = '...';

    private snackBar: MatSnackBar = inject(MatSnackBar);

    constructor(
        private authService: AuthService,
        private dialogRef: MatDialogRef<SettingsComponent>,
        private translate: TranslateService,
    ) {
        this.emailForm = new FormControl('...', [Validators.required, this.mustBeFilled]);
        this.selectedTheme = this.authService.user?.settings.themeUrl as string;
        this.themes = this.authService.user?.ownedItems.filter((item: Item) => item.type === ItemType.Theme) as Item[];
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngOnInit(): void {
        this.authService.getEmail().subscribe({
            next: (response: { email: string }) => {
                this.emailForm.patchValue(response.email);
                this.originalEmail = response.email;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
                else if (error.status === StatusCodes.NOT_FOUND) {
                    if (this.currentLanguage === Language.French) this.emailForm.patchValue('Introuvable');
                    else this.emailForm.patchValue('Not found');
                }
                return;
            },
        });
    }

    protected editEmail() {
        this.isEditingEmail = true;
    }

    protected cancelEdit() {
        this.isEditingEmail = false;
        this.emailForm.reset(this.originalEmail);
    }

    protected getActiveSection() {
        switch (this.activeSection) {
            case SettingSection.Theme:
                return this.currentLanguage === Language.French ? 'Personnalisation' : 'Personalization';
            case SettingSection.AuthLogs:
                return this.currentLanguage === Language.French ? 'Compte et sécurité' : 'Account and security';
        }
    }

    protected selectSection(section: SettingSection) {
        this.activeSection = section;
    }

    protected close() {
        this.dialogRef.close();
    }

    protected getTheme(themeUrl: string) {
        return './assets/backgrounds/' + themeUrl;
    }

    protected selectTheme(theme: Item) {
        this.authService.updateSettings({ themeUrl: theme.imageUrl }).subscribe({
            next: (user: User) => {
                this.authService.user = user;
                this.selectedTheme = user.settings.themeUrl;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
                // Pas envie de gérer les autres erreurs
            },
        });
    }

    protected onSubmit() {
        this.emailForm.setErrors(null);

        if (!this.isEmailValid()) {
            this.emailForm.setErrors({ errorMessage: ErrorMessage.InvalidEmail });
            return;
        }

        if (this.emailForm.hasError('errorMessage')) return;

        this.authService.updateEmail(this.emailForm.value).subscribe({
            next: (response: { email: string }) => {
                this.emailForm.patchValue(response.email);
                this.snackBar.open(
                    this.currentLanguage === Language.French ? 'Adresse courriel mise à jour!' : 'Email updated!',
                    '',
                    SNACK_BAR_NORMAL_CONFIGURATION,
                );
                this.originalEmail = response.email;
                this.cancelEdit();
            },
            error: (error: HttpErrorResponse) => {
                switch (error.status) {
                    case StatusCodes.UNAUTHORIZED:
                        this.authService.redirectToLogin();
                        break;
                    case StatusCodes.CONFLICT:
                        this.emailForm.setErrors({
                            errorMessage: this.currentLanguage === Language.French ? 'Adresse courriel indisponible' : 'Email unavailable',
                        });
                        break;
                    case StatusCodes.NOT_FOUND:
                        this.snackBar.open(
                            this.currentLanguage === Language.French ? 'Erreur lors de la mise à jour' : 'Unexpected error',
                            '',
                            SNACK_BAR_ERROR_CONFIGURATION,
                        );
                        break;
                }
            },
        });
    }

    protected isNewEmail() {
        return this.originalEmail.trim().toLowerCase() !== this.emailForm.value?.trim().toLowerCase();
    }

    private isEmailValid(): boolean {
        const email = this.emailForm.value;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    private mustBeFilled(formControl: AbstractControl) {
        const isEmailFilled = formControl.value?.trim() !== '';
        if (isEmailFilled) return null; // Valid, no errors
        return { notFilled: true }; // Invalid, error object
    }
}
