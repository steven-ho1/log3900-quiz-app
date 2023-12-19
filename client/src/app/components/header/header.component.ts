import { Component, Input } from '@angular/core';
import { Route } from '@app/constants/enums';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { RouteControllerService } from '@app/services/route-controller/route-controller.service';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
    @Input() title: string = '';
    mainMenuRoute: string = '/' + Route.MainMenu;
    gameCreationRoute: string = '/' + Route.GameCreation;

    constructor(
        private routeController: RouteControllerService,
        private clientSocket: ClientSocketService,
    ) {}

    get isCurrentPageLobby() {
        if (this.routeController.routes) return this.routeController.routes.get(Route.Lobby) && this.clientSocket.isOrganizer;
        return false;
    }
}
