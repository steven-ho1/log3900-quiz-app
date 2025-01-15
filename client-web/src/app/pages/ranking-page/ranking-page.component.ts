/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable no-console */
import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { StatsService } from '@app/services/stats/stats.service';
import { LeaderboardPlayer } from '@common/stats';
import { User, UserReference } from '@common/user';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-ranking-page',
    templateUrl: './ranking-page.component.html',
    styleUrls: ['./ranking-page.component.scss'],
})
export class RankingPageComponent implements OnInit, OnDestroy {
    protected backgroundImage;
    protected currentLanguage: string;
    protected showFriendsOnly: boolean = false;
    protected isLoading: boolean = true;

    private users: User[] = [];
    private friends: User[] = [];
    private sortDirection: { [key: string]: 'asc' | 'desc' } = {
        winRate: 'asc',
        averageTimePerGame: 'desc', // Start with descending for average time per game
        totalCompletedChallenges: 'asc',
    };
    private leaderboard: LeaderboardPlayer[] = [];
    private clientSocket: ClientSocketService = inject(ClientSocketService);
    private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);

    constructor(
        private authService: AuthService,
        private translate: TranslateService,
        private statsService: StatsService,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get filteredLeaderboard() {
        return this.showFriendsOnly
            ? this.leaderboard.filter(
                  (player: LeaderboardPlayer) =>
                      player.username === this.authService.user?.username || this.friends.some((friend: User) => player.username === friend.username),
              )
            : this.leaderboard;
    }

    get username() {
        return this.authService.user?.username;
    }

    ngOnInit(): void {
        this.listenForFriends();
        this.loadAllUsers();
        this.fetchLeaderboard();
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('userCreated');
    }

    listenForFriends() {
        this.clientSocket.socket.on('allUsers', (users: User[]) => {
            // Vu que user.friends dans authService n'a pas été mis à jour après qu'on ait ajouté un ami.
            this.users = users;
            this.authService.user = users.find((user: User) => user.id === this.authService.user?.id);
            this.friends = users.filter((user: User) => this.authService.user?.friends.some((friend: UserReference) => friend.id === user.id));
        });
    }

    fetchLeaderboard(): void {
        this.statsService.getLeaderboard().subscribe({
            next: (data) => {
                // Idéalement, il aurait fallu envoyer userId aussi pour les amis
                this.leaderboard = data;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error fetching leaderboard:', err);
            },
        });
    }

    sortLeaderboard(key: keyof LeaderboardPlayer): void {
        const direction = this.sortDirection[key];

        this.leaderboard.sort((a, b) => {
            if (a[key] < b[key]) {
                return direction === 'asc' ? -1 : 1;
            }
            if (a[key] > b[key]) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        this.sortDirection[key] = direction === 'asc' ? 'desc' : 'asc';
    }

    getAvatarImage(username: string) {
        const avatarUrl = this.users.find((user: User) => user.username === username)?.avatar;
        return this.authService.getAvatarImage(avatarUrl as string);
    }

    toggleShowFriend() {
        this.showFriendsOnly = !this.showFriendsOnly;
    }

    private loadAllUsers() {
        this.clientSocket.socket.emit('getAllUsers');
    }
}
