import { MatSnackBarConfig } from '@angular/material/snack-bar';

const SNACK_BAR_DURATION = 3000;
export const ACCESS_DENIED_MESSAGE = 'Erreur: Accès non autorisé ⚠️';
export const SERVER_ERROR_MESSAGE = 'Erreur du serveur ⚠️';

export const SNACK_BAR_NORMAL_CONFIGURATION: MatSnackBarConfig = {
    duration: SNACK_BAR_DURATION,
    verticalPosition: 'top',
};

export const SNACK_BAR_ERROR_CONFIGURATION: MatSnackBarConfig = {
    duration: SNACK_BAR_DURATION,
    panelClass: ['snack-bar-error'],
    verticalPosition: 'top',
};
