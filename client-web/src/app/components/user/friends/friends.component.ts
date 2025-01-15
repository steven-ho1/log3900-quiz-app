import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { FriendSection } from '@app/constants/user';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { Language, User, UserReference } from '@common/user';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-friends',
    templateUrl: './friends.component.html',
    styleUrls: ['./friends.component.scss'],
})
export class FriendsComponent implements OnInit, OnDestroy {
    currentUser: User;
    allUsers: UserReference[] = [];
    filteredUsers: UserReference[] = [];
    userFriends: UserReference[] = [];
    blockedUsers: UserReference[] = [];
    sentPendingUsers: UserReference[] = [];
    receivedPendingUsers: UserReference[] = [];
    userHasTyped = false;
    currentLanguage: string;
    protected activeSection: FriendSection = FriendSection.UserList;

    protected friendSection: FriendSection = FriendSection.Friends;
    protected searchSection: FriendSection = FriendSection.UserList;
    protected blockedSection: FriendSection = FriendSection.Block;
    protected sentPendingSection: FriendSection = FriendSection.SentPending;
    protected receivedPendingSection: FriendSection = FriendSection.ReceivedPending;
    private translate: TranslateService = inject(TranslateService);
    private snackBar: MatSnackBar = inject(MatSnackBar);

    constructor(
        private authService: AuthService,
        private dialogRef: MatDialogRef<FriendsComponent>,
        private readonly clientSocket: ClientSocketService,
    ) {
        this.configureBaseSocketFeatures();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngOnInit() {
        this.currentUser = this.authService.user as User;
        this.loadAllUsers();
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('userCreated');
        this.clientSocket.socket.removeAllListeners('allUsers');
    }

    getActiveSection() {
        switch (this.activeSection) {
            case FriendSection.UserList:
                return this.currentLanguage === Language.French ? 'Rechercher des utilisateurs' : 'Search users';
            case FriendSection.Friends:
                return this.currentLanguage === Language.French ? 'Amis' : 'Friends';
            case FriendSection.Block:
                return this.currentLanguage === Language.French ? 'Utilisateurs bloqués' : 'Blocked users';
            case FriendSection.SentPending:
                return this.currentLanguage === Language.French ? "Demandes d'ami envoyées" : 'Friend requests sent';
            case FriendSection.ReceivedPending:
                return this.currentLanguage === Language.French ? "Demandes d'ami reçues" : 'Friend requests received';
        }
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('userCreated', (user: User) => {
            const userReference: UserReference = {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
            };

            this.allUsers.push(userReference);
        });

        this.clientSocket.socket.on('allUsers', (allUsers: User[]) => {
            this.currentUser = allUsers.find((user) => user.id === this.currentUser.id) as User;
            this.allUsers = allUsers;
            this.sortUserLists();
        });

        this.clientSocket.socket.on('friendRequestError', (message: string) => {
            this.snackBar.open(message, '', SNACK_BAR_ERROR_CONFIGURATION);
        });
    }

    getAvatarImage(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }

    sortUserLists() {
        this.userFriends = this.allUsers.filter((user) => this.currentUser.friends.some((friend) => friend.id === user.id));

        this.blockedUsers = this.allUsers.filter((user) => this.currentUser.blockedPlayers.some((blocked) => blocked.id === user.id));

        this.sentPendingUsers = this.allUsers.filter((user) => this.currentUser.pendingSentRequests.some((pending) => pending.id === user.id));

        this.receivedPendingUsers = this.allUsers.filter((user) =>
            this.currentUser.pendingReceivedRequests.some((pending) => pending.id === user.id),
        );
    }

    // Charger toute la liste d'utilisateurs
    loadAllUsers() {
        this.clientSocket.socket.emit('getAllUsers');
    }

    // Méthode pour gérer la recherche d'utilisateur
    onSearch(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input) {
            const value = input.value.toLowerCase();
            if (value) {
                this.userHasTyped = true;
                this.filteredUsers = this.allUsers
                    .filter((user) => user.username.toLowerCase().includes(value) && user.username !== this.currentUser.username)
                    .filter((user) => !this.isFriend(user) && !this.isBlocked(user) && !this.isPendingSent(user) && !this.isPendingReceived(user));
            } else {
                this.userHasTyped = false;
                this.filteredUsers = [];
            }
        }
    }

    // Ces méthodes vérifient si un utilisateur est dans l'une des catégories suivantes : amis, bloqué, demande envoyée ou demande reçue.
    isFriend(user: UserReference): boolean {
        return this.currentUser.friends.some((friend) => friend.id === user.id);
    }
    isBlocked(user: UserReference): boolean {
        const isBlockedByCurrentUser = this.currentUser.blockedPlayers.some((blocked) => blocked.id === user.id);
        const hasBlockedCurrentUser = this.currentUser.blockedBy.some((blocked) => blocked.id === user.id);

        return isBlockedByCurrentUser || hasBlockedCurrentUser;
    }
    isPendingSent(user: UserReference): boolean {
        return this.currentUser.pendingSentRequests.some((sent) => sent.id === user.id);
    }
    isPendingReceived(user: UserReference): boolean {
        return this.currentUser.pendingReceivedRequests.some((received) => received.id === user.id);
    }

    // Ajouter un ami (simple envoie de socket la gestion se fait serveur et le retour est dans les listeners)
    addFriend(user: UserReference) {
        this.filteredUsers = this.filteredUsers.filter((filteredUser) => filteredUser.id !== user.id);
        this.clientSocket.socket.emit('sendFriendRequest', user.id);
    }

    removeFriend(user: UserReference) {
        this.userFriends = this.userFriends.filter((friend) => friend.id !== user.id);
        this.clientSocket.socket.emit('removeFriend', user.id);
    }

    // Bloquer un utilisateur (simple envoie de socket la gestion se fait serveur et le retour est dans les listeners)
    blockUser(user: UserReference) {
        this.filteredUsers = this.filteredUsers.filter((filteredUser) => filteredUser.id !== user.id);
        this.userFriends = this.userFriends.filter((filteredUser) => filteredUser.id !== user.id);
        this.clientSocket.socket.emit('blockUser', user.id);
    }

    unblockUser(user: UserReference) {
        this.blockedUsers = this.blockedUsers.filter((blockedUser) => blockedUser.id !== user.id);
        this.clientSocket.socket.emit('unblockUser', user.id);
    }

    acceptFriendRequest(user: UserReference) {
        this.receivedPendingUsers = this.receivedPendingUsers.filter((filteredUser) => filteredUser.id !== user.id);
        this.clientSocket.socket.emit('acceptFriendRequest', user.id);
    }

    declineFriendRequest(user: UserReference) {
        this.receivedPendingUsers = this.receivedPendingUsers.filter((filteredUser) => filteredUser.id !== user.id);
        this.clientSocket.socket.emit('declineFriendRequest', user.id);
    }

    protected selectSection(section: FriendSection) {
        this.activeSection = section;
    }
    protected close() {
        this.dialogRef.close();
    }
}
