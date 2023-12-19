import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';

const UNAUTHORIZED_ERROR = 401;
@Component({
    selector: 'app-password-popup',
    templateUrl: './password-popup.component.html',
    styleUrls: ['./password-popup.component.scss'],
})
export class PasswordPopupComponent {
    passwordForm: FormControl = new FormControl('', Validators.required);
    hidePassword = true;
    private router: Router = inject(Router);
    private snackBar: MatSnackBar = inject(MatSnackBar);

    constructor(
        public dialogRef: MatDialogRef<PasswordPopupComponent>,
        private gameHandler: GameHandlingService,
        private routeController: RouteControllerService,
    ) {}
    // Permettre l'accès à la page admin si c'est correct
    validatePassword(): void {
        this.gameHandler.verifyAdminPassword(this.passwordForm.value).subscribe({
            next: (response) => {
                if (response) {
                    this.dialogRef.close();
                    this.routeController.setRouteAccess(Route.Admin, true);
                    this.router.navigate([Route.Admin]);
                }
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === UNAUTHORIZED_ERROR) this.passwordForm.setErrors({ wrongPassword: true });
                else this.snackBar.open('Une erreur est survenue ⚠️', '', SNACK_BAR_ERROR_CONFIGURATION);
            },
        });
    }
}
