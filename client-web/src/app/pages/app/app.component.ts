/* eslint-disable no-console */
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { TOKEN } from '@app/constants/auth';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { AuthResponse } from '@common/auth';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

const CHANGE_DETECTION_PERIOD = 100;
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
    protected loading = true;
    protected isWindowDetachedChat = false;
    protected showChat = true;
    private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

    constructor(
        private clientSocket: ClientSocketService,
        private authService: AuthService,
        private translate: TranslateService,
    ) {
        this.translate.addLangs([Language.French, Language.English]);
        this.translate.setDefaultLang(Language.French);
        this.translate.use(Language.French);
    }

    get isAuthenticated() {
        return this.authService.isAuthenticated;
    }

    ngOnInit(): void {
        if (window.electron) {
            window.electron.ipcRenderer.on('initializeWindow', (isMainWindow, token) => {
                if (isMainWindow) {
                    this.loadApp();
                    return;
                }
                this.isWindowDetachedChat = true;
                this.loadDetachedChat(token as string);
            });

            window.electron.ipcRenderer.on('reattach-chat', () => {
                this.showChat = true;
                console.log('TEST');
                this.cdr.detectChanges();
            });
        } else {
            this.loadApp();
        }

        window.setInterval(() => {
            this.cdr.detectChanges();
        }, CHANGE_DETECTION_PERIOD);
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('disconnect');
    }

    onDetached() {
        this.showChat = false;
        this.cdr.detectChanges();
    }

    private loadApp() {
        const token = sessionStorage.getItem(TOKEN);
        if (token) {
            this.authService
                .loadSession()
                .pipe(
                    finalize(() => {
                        this.loading = false;
                    }),
                )
                .subscribe({
                    next: (response: AuthResponse) => {
                        this.authService.redirectToMain(response.user as User, response.token as string);
                    },
                    error: () => {
                        this.authService.redirectToLogin();
                    },
                });
        } else {
            this.authService.redirectToLogin();
            this.loading = false;
        }
    }

    private loadDetachedChat(token: string) {
        sessionStorage.setItem(TOKEN, token);
        this.authService
            .loadDetachedChat()
            .pipe(
                finalize(() => {
                    this.loading = false;
                }),
            )
            .subscribe({
                next: (response: AuthResponse) => {
                    this.authService.user = response.user;
                    this.authService.redirectToDetachedChat();
                },
                error: () => {
                    return;
                },
            });
    }
}
