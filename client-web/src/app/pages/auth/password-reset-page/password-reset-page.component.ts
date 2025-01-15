import { Component, inject } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { ResetForm } from '@app/constants/auth';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-password-reset-page',
    templateUrl: './password-reset-page.component.html',
    styleUrls: ['./password-reset-page.component.scss'],
})
export class PasswordResetPageComponent {
    protected activeForm: string = ResetForm.ResetRequest;
    protected emailForm: FormControl = new FormControl('', [Validators.required, this.mustBeFilled]);
    protected currentLanguage: string;

    private translate: TranslateService = inject(TranslateService);

    constructor() {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    protected onFormChange(newForm: ResetForm) {
        this.activeForm = newForm;
    }

    private mustBeFilled(formControl: AbstractControl) {
        const isEmailFilled = formControl.value.trim() !== '';
        if (isEmailFilled) return null; // Valid, no errors
        return { notFilled: true }; // Invalid, error object
    }
}
