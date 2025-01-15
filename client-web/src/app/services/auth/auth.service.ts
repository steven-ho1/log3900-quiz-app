/* eslint-disable @typescript-eslint/naming-convention */
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TOKEN, USERNAME } from '@app/constants/auth';
import { Route } from '@app/constants/enums';
import { ErrorMessage } from '@app/constants/error-message';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { AuthData, AuthLog, AuthResponse } from '@common/auth';
import { DEFAULT_AVATARS, Item, NO_AVATAR_IMAGE, SHOP_AVATARS } from '@common/item';
import { Language, ProfileUpdate, SettingUpdate, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';
import { catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    user: User | undefined;
    authForm: FormGroup;
    isAuthenticated: boolean = false;
    isPasswordValid: boolean = false;
    private fb: FormBuilder = inject(FormBuilder);
    private clientSocket: ClientSocketService = inject(ClientSocketService);
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private router: Router,
        private httpClient: HttpClient,
        private snackBar: MatSnackBar,
    ) {
        this.authForm = this.fb.group({
            username: ['', Validators.required],
            email: ['', Validators.required],
            password: ['', Validators.required],
            avatar: ['', Validators.required],
        });
    }

    getAuthLogs() {
        return this.httpClient
            .get<AuthLog[]>(`${environment.serverBaseUrl}/api/users/${this.user?.id}/auth-logs`, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    submitPasswordResetRequest(payload: { email: string; language: string }) {
        return this.httpClient.post<void>(`${environment.serverBaseUrl}/api/auth/password-reset`, payload).pipe(catchError(this.handleError));
    }

    submitResetCode(payload: { email: string; code: string }) {
        return this.httpClient
            .post<void>(`${environment.serverBaseUrl}/api/auth/password-reset/code-verification`, payload)
            .pipe(catchError(this.handleError));
    }

    submitNewPassword(payload: { email: string; newPassword: string }) {
        return this.httpClient
            .post<void>(`${environment.serverBaseUrl}/api/auth/password-reset/new-password`, payload)
            .pipe(catchError(this.handleError));
    }

    loadSession() {
        return this.httpClient
            .get<AuthResponse>(`${environment.serverBaseUrl}/api/auth/session-loading`, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    loadDetachedChat() {
        return this.httpClient
            .get<AuthResponse>(`${environment.serverBaseUrl}/api/auth/detached-chat-loading`, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    login() {
        const authData: AuthData = this.authForm.value;
        delete authData.email;
        delete authData.avatar;
        return this.httpClient.post<AuthResponse>(`${environment.serverBaseUrl}/api/auth/login`, authData).pipe(catchError(this.handleError));
    }

    register(language: Language) {
        const authData: AuthData = this.authForm.value;
        authData.language = language;
        return this.httpClient.post<AuthResponse>(`${environment.serverBaseUrl}/api/auth/register`, authData).pipe(catchError(this.handleError));
    }

    updateAvatar(profileUpdate: ProfileUpdate) {
        return this.httpClient
            .patch<User>(
                `${environment.serverBaseUrl}/api/users/${(this.user as User).id}/profile/avatar`,
                profileUpdate,
                this.setAuthorizationHeader(),
            )
            .pipe(catchError(this.handleError));
    }

    updateUsername(profileUpdate: ProfileUpdate) {
        return this.httpClient
            .patch<User>(
                `${environment.serverBaseUrl}/api/users/${(this.user as User).id}/profile/username`,
                profileUpdate,
                this.setAuthorizationHeader(),
            )
            .pipe(catchError(this.handleError));
    }

    updateSettings(settingUpdate: SettingUpdate) {
        return this.httpClient
            .patch<User>(`${environment.serverBaseUrl}/api/users/${(this.user as User).id}/settings`, settingUpdate, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    getEmail() {
        return this.httpClient
            .get<{ email: string }>(`${environment.serverBaseUrl}/api/users/${(this.user as User).id}/settings/email`, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    updateEmail(email: { email: string }) {
        return this.httpClient
            .patch<{ email: string }>(
                `${environment.serverBaseUrl}/api/users/${(this.user as User).id}/settings/email`,
                { email },
                this.setAuthorizationHeader(),
            )
            .pipe(catchError(this.handleError));
    }

    resetForm() {
        this.authForm.reset({
            username: '',
            email: '',
            password: '',
            avatar: '',
        });
        this.isPasswordValid = false;
    }

    areFieldsFilled(isLogin?: boolean): boolean {
        const authData: AuthData = this.authForm.value;
        if (isLogin) {
            delete authData.email;
            delete authData.avatar;
        }
        const allControlsFilled = Object.values(authData).every((value) => (value as string)?.trim() !== '');
        return allControlsFilled;
    }

    redirectToMain(user: User, token: string) {
        sessionStorage.setItem(USERNAME, user.username);
        sessionStorage.setItem(TOKEN, token);
        this.user = user;
        this.translate.use(user.settings.languagePreference);

        this.clientSocket.connect(user);

        this.clientSocket.socket.on('connect', () => {
            this.isAuthenticated = true;
            this.clientSocket.socket.off('connect');
            this.router.navigate([Route.MainMenu]);
        });
    }

    redirectToDetachedChat() {
        this.clientSocket.connect(this.user as User, true);

        this.clientSocket.socket.on('connect', () => {
            this.clientSocket.socket.off('connect');
            this.router.navigate([Route.Chat]);
        });
    }

    redirectToLogin() {
        sessionStorage.removeItem(TOKEN);
        sessionStorage.removeItem(USERNAME);
        this.clientSocket.disconnect();
        this.user = undefined;
        this.isAuthenticated = false;
        this.router.navigate([Route.Login]);
    }

    setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }

    getAvatarImage(avatarUrl: string) {
        if (DEFAULT_AVATARS.concat(SHOP_AVATARS).find((item: Item) => item.imageUrl === avatarUrl) || avatarUrl === NO_AVATAR_IMAGE) {
            return './assets/avatars/' + avatarUrl;
        } else {
            // Avatar téléversé sous forme d'un string base64
            return avatarUrl;
        }
    }

    getBackgroundImage(useDark?: boolean) {
        const backgroundImage = this.user?.settings.themeUrl;
        const url = `url('./assets/backgrounds/${backgroundImage}')`;
        if (useDark) return { 'background-image': `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), ${url}` };
        return { 'background-image': url };
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
