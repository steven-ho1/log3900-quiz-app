import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
    @Input() title: string = '';
    mainMenuRoute: string = '/' + Route.MainMenu;
    gameCreationRoute: string = '/' + Route.GameCreation;
    hubPickRoute: string = '/' + Route.HubPick;

    constructor(
        private router: Router,
        private clientSocket: ClientSocketService,
    ) {}

    get isOrganizer() {
        return this.clientSocket.isOrganizer;
    }

    get isCurrentPageLobby() {
        return this.router.url === Route.Lobby;
    }
}
