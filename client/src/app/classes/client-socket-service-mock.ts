import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { Socket } from 'socket.io-client';
import { SocketMock } from './socket-mock';

export class ClientSocketServiceMock extends ClientSocketService {
    socket: Socket = new SocketMock() as unknown as Socket;

    constructor() {
        const route = {} as unknown as Router;
        const snackBar = {} as unknown as MatSnackBar;
        super(route, snackBar);
    }

    override connect(): void {
        return;
    }
}
