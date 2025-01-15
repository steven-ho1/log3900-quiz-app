import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, inject, Input, Output, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ResetForm } from '@app/constants/auth';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-reset-code-form',
    templateUrl: './reset-code-form.component.html',
    styleUrls: ['./reset-code-form.component.scss'],
})
export class ResetCodeFormComponent implements AfterViewInit {
    @ViewChild('codeInput', { static: false }) codeInput: ElementRef<HTMLInputElement>;
    @Output() formChange = new EventEmitter<ResetForm>();
    @Input() emailForm: FormControl;
    protected isLoading = false;
    protected codeForm: FormControl = new FormControl('', [Validators.required, this.mustBeFilled]);

    private currentLanguage: string;
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
        if (this.codeInput) {
            this.codeInput.nativeElement.focus();
            this.changeDetector.detectChanges();
        }
    }

    protected redirectToEmailForm() {
        this.formChange.emit(ResetForm.ResetRequest);
    }

    protected onSubmit() {
        this.isLoading = true;
        this.authService
            .submitResetCode({ email: this.emailForm.value, code: this.codeForm.value.trim() })
            .pipe(
                finalize(() => {
                    this.isLoading = false;
                }),
            )
            .subscribe({
                next: () => {
                    this.formChange.emit(ResetForm.NewPassword);
                },
                error: (error: HttpErrorResponse) => {
                    if (error.status === StatusCodes.UNAUTHORIZED)
                        this.snackBar.open(this.currentLanguage === 'FR' ? 'Code erroné' : 'Wrong code', '', SNACK_BAR_ERROR_CONFIGURATION);
                },
            });
    }

    private mustBeFilled(formControl: AbstractControl) {
        const isEmailFilled = formControl.value.trim() !== '';
        if (isEmailFilled) return null; // Valid, no errors
        return { notFilled: true }; // Invalid, error object
    }
}
