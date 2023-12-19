import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { SERVER_ERROR_MESSAGE, SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
    constructor(
        private clientSocket: ClientSocketService,
        private snackBar: MatSnackBar,
        private router: Router,
    ) {}

    ngOnInit(): void {
        this.clientSocket.connect();

        this.clientSocket.socket.on('disconnect', () => {
            this.snackBar.open(SERVER_ERROR_MESSAGE, '', SNACK_BAR_ERROR_CONFIGURATION);
            this.router.navigate([Route.MainMenu]);
        });
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('disconnect');
    }
}
