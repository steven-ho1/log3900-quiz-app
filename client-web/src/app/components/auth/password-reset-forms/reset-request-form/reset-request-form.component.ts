import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ResetForm } from '@app/constants/auth';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-reset-request-form',
    templateUrl: './reset-request-form.component.html',
    styleUrls: ['./reset-request-form.component.scss'],
})
export class ResetRequestFormComponent implements AfterViewInit {
    @ViewChild('emailInput', { static: false }) emailInput: ElementRef<HTMLInputElement>;
    @Input() emailForm: FormControl;
    @Output() formChange = new EventEmitter<ResetForm>();
    protected isLoading: boolean = false;

    protected currentLanguage: string;
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
        if (this.emailInput) {
            this.emailInput.nativeElement.focus();
            this.changeDetector.detectChanges();
        }
    }

    onSubmit() {
        this.emailForm.setErrors(null);

        if (!this.isEmailValid()) {
            this.emailForm.setErrors({ errorMessage: this.currentLanguage === 'FR' ? 'Adresse courriel invalide' : 'Invalid email' });
            return;
        }

        this.isLoading = true;
        this.authService
            .submitPasswordResetRequest({ email: this.emailForm.value, language: this.currentLanguage })
            .pipe(
                finalize(() => {
                    this.isLoading = false;
                }),
            )
            .subscribe({
                next: () => {
                    this.formChange.emit(ResetForm.Code);
                },
                error: () => {
                    this.snackBar.open(this.currentLanguage === 'FR' ? 'Erreur inattendue' : 'Unexpected error', '', SNACK_BAR_ERROR_CONFIGURATION);
                },
            });
    }

    private isEmailValid(): boolean {
        const email = this.emailForm.value;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    }
}
