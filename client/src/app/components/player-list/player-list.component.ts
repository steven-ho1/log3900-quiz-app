import { Component, OnDestroy, OnInit } from '@angular/core';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { LobbyDetails, Player, PlayerColor } from '@common/lobby';
const REVERT_SORT = -1;
@Component({
    selector: 'app-player-list',
    templateUrl: './player-list.component.html',
    styleUrls: ['./player-list.component.scss'],
})
export class PlayerListComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    property: string = 'name';
    ascendingOrder: boolean = true;
    constructor(private clientSocket: ClientSocketService) {}

    ngOnInit(): void {
        this.configureBaseSocketFeatures();
        this.clientSocket.socket.emit('getPlayers');
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('latestPlayerList');
        this.clientSocket.socket.removeAllListeners('scoreUpdated');
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('latestPlayerList', (lobbyDetails: LobbyDetails) => {
            if (this.players.length === 0) {
                // Initialise quand la liste est vide
                this.players = lobbyDetails.players;
            } else {
                this.players.forEach((player) => {
                    // Change les proprietes des joueurs sans les enlever de la liste
                    const updatedPlayer = lobbyDetails.players.find((p) => p.socketId === player.socketId);
                    if (!updatedPlayer) {
                        player.activityState = PlayerColor.Black;
                    } else {
                        player.activityState = updatedPlayer.activityState;
                    }
                });
            }
            this.sortPlayers();
        });

        this.clientSocket.socket.on('scoreUpdated', (updatedPlayer: Player) => {
            // update le score du joueur
            const player = this.players.find((p) => p.socketId === updatedPlayer.socketId);
            if (player) {
                player.score = updatedPlayer.score;
            }
            if (this.property === 'score') this.sortPlayers();
        });
    }
    toggleMute(player: Player) {
        player.isAbleToChat = !player.isAbleToChat;
        this.clientSocket.socket.emit('toggleMute', player);
    }

    sortPlayers() {
        // Fonction de sorting
        this.players.sort((a, b) => {
            if (this.ascendingOrder) {
                return this.compare(a, b);
            } else {
                return REVERT_SORT * this.compare(a, b);
            }
        });
    }

    compare(a: Player, b: Player): number {
        switch (this.property) {
            case 'score': {
                const scoreComparison = a.score - b.score;
                return scoreComparison !== 0
                    ? scoreComparison
                    : this.ascendingOrder
                    ? a.name.localeCompare(b.name) // Compare les noms si les scores sont les memes.
                    : REVERT_SORT * a.name.localeCompare(b.name);
            }
            default: {
                return a.name.localeCompare(b.name);
            }
            case 'activityState': {
                const activityOrder = { red: 0, yellow: 1, green: 2, black: 3 };
                const activityComparison = activityOrder[a.activityState] - activityOrder[b.activityState];
                return activityComparison !== 0
                    ? activityComparison
                    : this.ascendingOrder
                    ? a.name.localeCompare(b.name) // Compare les noms si les states couleurs sont les memes.
                    : REVERT_SORT * a.name.localeCompare(b.name);
            }
        }
    }
    toggleSortOrder() {
        this.ascendingOrder = !this.ascendingOrder;
        this.sortPlayers();
    }
    setSortingPropertyAndSort(property: string) {
        this.property = property;
        this.sortPlayers();
    }
    getActivityClass(player: Player): string {
        // Pour le css et html de la couleur de chaque joueur
        return player.activityState;
    }
}
