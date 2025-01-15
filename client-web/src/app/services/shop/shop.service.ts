import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TOKEN } from '@app/constants/auth';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { Item } from '@common/item';
import { User } from '@common/user';
import { StatusCodes } from 'http-status-codes';
import { catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class ShopService {
    constructor(
        private httpClient: HttpClient,
        private snackBar: MatSnackBar,
        private authService: AuthService,
    ) {}

    sendOrder(item: Item) {
        return this.httpClient
            .post<User>(`${environment.serverBaseUrl}/api/users/${this.authService.user?.id}/purchase`, item, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    rewardUser(reward: number) {
        return this.httpClient
            .post<User>(`${environment.serverBaseUrl}/api/users/${this.authService.user?.id}/reward`, { reward }, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    private setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }

    private handleError = (error: HttpErrorResponse) => {
        // Network error
        if (error.error instanceof ProgressEvent) {
            this.snackBar.open(ErrorMessage.NetworkError, '', SNACK_BAR_ERROR_CONFIGURATION);
        } else if (error.status === StatusCodes.INTERNAL_SERVER_ERROR) {
            this.snackBar.open(ErrorMessage.UnexpectedError, '', SNACK_BAR_ERROR_CONFIGURATION);
        }

        return throwError(() => error);
    };
}
