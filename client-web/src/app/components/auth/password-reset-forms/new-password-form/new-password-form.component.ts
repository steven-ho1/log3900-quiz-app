import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ResetForm } from '@app/constants/auth';
import { MINIMUM_PASSWORD_LENGTH, Requirement } from '@app/constants/password-validation';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-new-password-form',
    templateUrl: './new-password-form.component.html',
    styleUrls: ['./new-password-form.component.scss'],
})
export class NewPasswordFormComponent implements AfterViewInit {
    @ViewChild('newPasswordInput', { static: false }) newPasswordInput: ElementRef<HTMLInputElement>;
    @Input() emailForm: FormControl;
    @Output() formChange = new EventEmitter<ResetForm>();
    protected newPasswordForm: FormControl = new FormControl('', [Validators.required, this.mustBeFilled]);
    protected isPasswordValid: boolean = false;

    protected isLoading: boolean = false;

    protected frRequirements = [
        { name: Requirement.MinLengthValid, text: '8 caractères' },
        { name: Requirement.HasUppercase, text: '1 lettre majuscule' },
        { name: Requirement.HasLowercase, text: '1 lettre minuscule' },
        { name: Requirement.HasNumber, text: '1 chiffre' },
        { name: Requirement.HasSpecialChar, text: '1 caractère spécial' },
    ];

    protected enRequirements = [
        { name: Requirement.MinLengthValid, text: '8 characters' },
        { name: Requirement.HasUppercase, text: '1 uppercase letter' },
        { name: Requirement.HasLowercase, text: '1 lowercase letter' },
        { name: Requirement.HasNumber, text: '1 number' },
        { name: Requirement.HasSpecialChar, text: '1 special character' },
    ];

    protected showPassword = false;
    protected showOverlay = false;

    protected currentLanguage: string;

    private validationResults: { [key in Requirement]: boolean } = {
        [Requirement.MinLengthValid]: false,
        [Requirement.HasUppercase]: false,
        [Requirement.HasLowercase]: false,
        [Requirement.HasNumber]: false,
        [Requirement.HasSpecialChar]: false,
    };

    private translate: TranslateService = inject(TranslateService);
    constructor(
        private authService: AuthService,
        private changeDetector: ChangeDetectorRef,
        private snackBar: MatSnackBar,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngAfterViewInit(): void {
        if (this.newPasswordInput) {
            this.newPasswordInput.nativeElement.focus();
            this.changeDetector.detectChanges();
        }
    }

    validatePassword(): void {
        const password = this.newPasswordForm.value;
        this.validationResults = {
            [Requirement.MinLengthValid]: password.length >= MINIMUM_PASSWORD_LENGTH,
            [Requirement.HasUppercase]: /[A-Z]/.test(password),
            [Requirement.HasLowercase]: /[a-z]/.test(password),
            [Requirement.HasNumber]: /[0-9]/.test(password),
            [Requirement.HasSpecialChar]: /[^A-Za-z0-9]/.test(password),
        };

        const isValid = Object.values(this.validationResults).every((result) => result === true);
        this.isPasswordValid = isValid;
    }

    checkValidation(name: Requirement): boolean {
        return this.validationResults[name];
    }

    onSubmit() {
        this.isLoading = true;
        this.authService
            .submitNewPassword({ email: this.emailForm.value, newPassword: this.newPasswordForm.value })
            .pipe(
                finalize(() => {
                    this.isLoading = false;
                }),
            )
            .subscribe({
                next: () => {
                    this.formChange.emit(ResetForm.SuccessfulState);
                },
                error: () => {
                    this.snackBar.open('Erreur inattendue', '', SNACK_BAR_ERROR_CONFIGURATION);
                },
            });
    }

    private mustBeFilled(formControl: AbstractControl) {
        const isEmailFilled = formControl.value.trim() !== '';
        if (isEmailFilled) return null; // Valid, no errors
        return { notFilled: true }; // Invalid, error object
    }
}
