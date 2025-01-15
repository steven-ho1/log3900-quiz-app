import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { AuthService } from '@app/services/auth/auth.service';
import { AuthResponse } from '@common/auth';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-login-form',
    templateUrl: './login-form.component.html',
    styleUrls: ['./login-form.component.scss'],
})
export class LoginFormComponent implements OnDestroy {
    protected authForm: FormGroup = this.authService.authForm;
    protected isLoading = false;
    private errorStatus: number;

    constructor(
        private authService: AuthService,
        private translate: TranslateService,
    ) {
        this.handleErrorTranslation();
    }

    get areFieldsFilled() {
        return this.authService.areFieldsFilled(true);
    }

    ngOnDestroy() {
        this.authService.resetForm();
    }

    onSubmit() {
        this.isLoading = true;
        this.authForm.markAllAsTouched();
        this.authService
            .login()
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
                    let errorMessage;
                    if (error.status === StatusCodes.UNAUTHORIZED) {
                        this.errorStatus = StatusCodes.UNAUTHORIZED;
                        if (this.translate.currentLang === Language.French) errorMessage = 'Identifiants invalides';
                        else errorMessage = 'Invalid credentials';
                        this.authForm.get('password')?.setErrors({ errorMessage });
                    } else if (error.status === StatusCodes.CONFLICT) {
                        this.errorStatus = StatusCodes.CONFLICT;
                        if (this.translate.currentLang === Language.French) errorMessage = 'Vous êtes déjà connecté';
                        else errorMessage = 'You are already logged in';
                        this.authForm.get('password')?.setErrors({ errorMessage });
                    }
                    this.authForm.markAsDirty();
                },
            });
    }

    private handleErrorTranslation() {
        this.translate.onLangChange.subscribe(() => {
            if (this.authForm.get('password')) {
                let errorMessage;
                if (this.errorStatus === StatusCodes.UNAUTHORIZED) {
                    if (this.translate.currentLang === Language.French) errorMessage = 'Identifiants invalides';
                    else errorMessage = 'Invalid credentials';
                    this.authForm.get('password')?.setErrors({ errorMessage });
                } else if (this.errorStatus === StatusCodes.CONFLICT) {
                    if (this.translate.currentLang === Language.French) errorMessage = 'Vous êtes déjà connecté';
                    else errorMessage = 'You are already logged in';
                    this.authForm.get('password')?.setErrors({ errorMessage });
                }
            }
        });
    }
}
