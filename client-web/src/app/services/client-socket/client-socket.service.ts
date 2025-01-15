import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { Pin, Player } from '@common/lobby';
import { Language, User } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ManagerOptions, Socket, SocketOptions, io } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class ClientSocketService {
    // Service qui s'occupe de la communication des sockets
    socket: Socket;
    isOrganizer: boolean = false;
    playerName: string = '';
    pin: Pin = '';
    histogramData: BehaviorSubject<{ [key: string]: number }> = new BehaviorSubject({});
    histogramData$: Observable<{ [key: string]: number }> = this.histogramData.asObservable();
    players: Player[] = [];
    hasGameEnded: boolean = false;
    private currentLanguage: string;

    constructor(
        private router: Router,
        private snackBar: MatSnackBar,
        private translate: TranslateService,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    connect(user: User, isChatWindow?: boolean): void {
        if (!this.isSocketAlive()) {
            const options: Partial<ManagerOptions & SocketOptions> = {
                transports: ['websocket'],
                auth: { userId: user.id },
                upgrade: false,
                reconnection: true,
            };

            if (isChatWindow)
                options.query = {
                    isChatWindow,
                };

            this.socket = io(environment.serverBaseUrl, options);
            this.listenForGameClosureByOrganiser();
        }
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.io.opts.reconnection = false;
            this.socket.disconnect();
        }
    }

    giveOrganiserPermissions(): void {
        this.isOrganizer = true;
        this.playerName = 'Organisateur';
    }

    resetPlayerInfo(): void {
        this.isOrganizer = false;
        this.playerName = '';
        this.socket.emit('leaveLobby');
        this.hasGameEnded = false;
    }

    listenForGameClosureByOrganiser() {
        this.socket.on('lobbyClosed', (reason, message) => {
            if (!this.hasGameEnded) {
                let messageToShow: string;
                if (reason === 'NO HOST') {
                    messageToShow = this.currentLanguage === Language.French ? 'Aucun organisateur' : 'No host';
                } else messageToShow = message; // Message de ban

                this.router.navigate([Route.MainMenu]);
                this.snackBar.open(messageToShow, '', SNACK_BAR_ERROR_CONFIGURATION);
            }
        });
    }

    listenUpdateHistogram(): Observable<{ [key: string]: number }> {
        return new Observable((observer) => {
            this.socket.on('updateHistogram', (histogram: { [key: string]: number }) => {
                this.histogramData.next(histogram);
                observer.next(histogram);
            });
        });
    }

    listenQrlUpdateHistogram(): Observable<{ [key: string]: number }> {
        return new Observable((observer) => {
            this.socket.on('qrlUpdateHistogram', (histogram: { [key: string]: number }) => {
                this.histogramData.next(histogram);
                observer.next(histogram);
            });
        });
    }

    sendUpdateHistogram(histogramData: { [key: string]: number }): void {
        this.socket.emit('histogramUpdate', histogramData);
    }

    sendResetHistogram(): void {
        this.socket.emit('resetHistogram');
    }

    sendQrlUpdateHistogram(histogramData: { [key: string]: number }): void {
        this.socket.emit('qrlHistogramUpdate', histogramData);
    }

    isSocketAlive(): boolean {
        return this.socket && this.socket.connected;
    }
}
