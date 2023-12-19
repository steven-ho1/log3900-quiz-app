import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { Pin, Player } from '@common/lobby';
import { BehaviorSubject, Observable } from 'rxjs';
import { Socket, io } from 'socket.io-client';
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

    constructor(
        private router: Router,
        private snackBar: MatSnackBar,
    ) {}

    isSocketAlive(): boolean {
        return this.socket && this.socket.connected;
    }

    connect(): void {
        if (!this.isSocketAlive()) {
            this.socket = io(environment.serverBaseUrl, { transports: ['websocket'], upgrade: false });
            this.listenForGameClosureByOrganiser();
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
    }

    listenForGameClosureByOrganiser() {
        this.socket.on('lobbyClosed', (reason, message) => {
            this.router.navigate([Route.MainMenu]);
            if (reason === 'NO HOST') {
                this.snackBar.open(message, '', SNACK_BAR_ERROR_CONFIGURATION);
            } else {
                this.snackBar
                    .open(message, 'Rentrer', SNACK_BAR_ERROR_CONFIGURATION)
                    .onAction()
                    .subscribe(() => {
                        this.socket.emit('validatePin', this.pin);
                    });
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
}
