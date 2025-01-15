import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ErrorMessage } from '@app/constants/error-message';
import { AuthService } from '@app/services/auth/auth.service';
import { AuthResponse, ConflictType } from '@common/auth';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-register-form',
    templateUrl: './register-form.component.html',
    styleUrls: ['./register-form.component.scss'],
})
export class RegisterFormComponent implements OnDestroy {
    protected authForm: FormGroup = this.authService.authForm;
    protected confirmationForm: FormControl = new FormControl('', [Validators.required]);
    protected showPassword = false;
    protected isLoading = false;
    protected currentLanguage: string;

    constructor(
        private authService: AuthService,
        private translate: TranslateService,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get isPasswordValid(): boolean {
        return this.authService.isPasswordValid;
    }

    get areFieldsFilled() {
        return this.authService.areFieldsFilled();
    }

    ngOnDestroy() {
        this.authService.resetForm();
    }

    onSubmit() {
        this.authForm.get('username')?.setErrors(null);
        this.authForm.get('email')?.setErrors(null);

        if (!this.isEmailValid()) this.authForm.get('email')?.setErrors({ errorMessage: ErrorMessage.InvalidEmail });
        if (!this.isPasswordConfirmed()) this.confirmationForm.setErrors({ errorMessage: ErrorMessage.PasswordConfirmationError });
        if (this.authForm.get('email')?.hasError('errorMessage') || this.confirmationForm.hasError('errorMessage')) return;

        this.isLoading = true;
        this.authForm.markAllAsTouched();
        this.confirmationForm.setErrors(null);
        this.authService
            .register(this.currentLanguage as Language)
            .pipe(
                finalize(() => {
                    this.isLoading = false;
                }),
            )
            .subscribe({
                next: (response: AuthResponse) => {
                    this.authService.redirectToMain(response.user as User, response.token as string);
                },
                error: (error: HttpErrorResponse) => {
                    if (error.status === StatusCodes.CONFLICT) {
                        let errorMessage;
                        if (error.error.errors.username === ConflictType.Username) {
                            if (this.translate.currentLang === Language.French) errorMessage = "Nom d'utilisateur indisponible";
                            else errorMessage = 'Username unavailable';
                            this.authForm.get('username')?.setErrors({ errorMessage });
                        }
                        if (error.error.errors.email === ConflictType.Email) {
                            if (this.translate.currentLang === Language.French) errorMessage = 'Adresse courriel indisponible';
                            else errorMessage = 'Email unavailable';
                            this.authForm.get('email')?.setErrors({ errorMessage });
                        }
                    }
                },
            });
    }

    private isEmailValid(): boolean {
        const email = this.authForm.value.email;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }

    private isPasswordConfirmed() {
        return this.authForm.value.password === this.confirmationForm.value;
    }
}
