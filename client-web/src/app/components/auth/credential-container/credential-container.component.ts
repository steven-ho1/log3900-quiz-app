import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MINIMUM_PASSWORD_LENGTH, Requirement } from '@app/constants/password-validation';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';

@Component({
    selector: 'app-credential-container',
    templateUrl: './credential-container.component.html',
    styleUrls: ['./credential-container.component.scss'],
})
export class CredentialContainerComponent implements AfterViewInit {
    @ViewChild('usernameInput', { static: false }) usernameInput: ElementRef;
    @Input() isRegiserForm: boolean = false;

    protected requirements = [
        { name: Requirement.MinLengthValid, text: '8 caractères' },
        { name: Requirement.HasUppercase, text: '1 lettre majuscule' },
        { name: Requirement.HasLowercase, text: '1 lettre minuscule' },
        { name: Requirement.HasNumber, text: '1 chiffre' },
        { name: Requirement.HasSpecialChar, text: '1 caractère spécial' },
    ];

    protected authForm: FormGroup = this.authService.authForm;
    protected showPassword = false;
    protected showOverlay = false;

    private validationResults: { [key in Requirement]: boolean } = {
        [Requirement.MinLengthValid]: false,
        [Requirement.HasUppercase]: false,
        [Requirement.HasLowercase]: false,
        [Requirement.HasNumber]: false,
        [Requirement.HasSpecialChar]: false,
    };

    constructor(
        private authService: AuthService,
        private clientSocketService: ClientSocketService,
        private changeDetector: ChangeDetectorRef,
    ) {
        this.clientSocketService.disconnect();
    }

    ngAfterViewInit(): void {
        if (this.usernameInput) {
            this.usernameInput.nativeElement.focus();
            this.changeDetector.detectChanges();
        }
    }

    validatePassword(): void {
        const password = this.authForm.value.password;
        this.validationResults = {
            [Requirement.MinLengthValid]: password.length >= MINIMUM_PASSWORD_LENGTH,
            [Requirement.HasUppercase]: /[A-Z]/.test(password),
            [Requirement.HasLowercase]: /[a-z]/.test(password),
            [Requirement.HasNumber]: /[0-9]/.test(password),
            [Requirement.HasSpecialChar]: /[^A-Za-z0-9]/.test(password),
        };

        const isValid = Object.values(this.validationResults).every((result) => result === true);
        this.authService.isPasswordValid = isValid;
    }

    checkValidation(name: Requirement): boolean {
        return this.validationResults[name];
    }
}
