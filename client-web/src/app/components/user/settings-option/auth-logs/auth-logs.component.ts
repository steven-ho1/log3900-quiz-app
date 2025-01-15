import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { AuthLog } from '@common/auth';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

@Component({
    selector: 'app-auth-logs',
    templateUrl: './auth-logs.component.html',
    styleUrls: ['./auth-logs.component.scss'],
})
export class AuthLogsComponent {
    protected firstColumn: string = 'timestamp';
    protected secondColumn: string = 'authEvent';

    protected authLogs: AuthLog[] | null | undefined = undefined;
    protected displayedColumns: string[] = [this.firstColumn, this.secondColumn];
    protected currentLanguage: string;

    constructor(
        private authService: AuthService,
        private translate: TranslateService,
    ) {
        this.loadAuthLogs();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    loadAuthLogs() {
        this.authService.getAuthLogs().subscribe({
            next: (authLogs: AuthLog[]) => {
                this.authLogs = authLogs;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.UNAUTHORIZED) this.authService.redirectToLogin();
                else this.authLogs = null;
            },
        });
    }
}
