/* eslint-disable no-console */
import { Component, OnInit, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MAX_CHANNEL_NAME_LENGTH } from '@app/constants/chat';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { Channel } from '@common/channel';

@Component({
    selector: 'app-channel-search',
    templateUrl: './channel-search.component.html',
    styleUrls: ['./channel-search.component.scss'],
})
export class ChannelSearchComponent implements OnInit {
    protected maxChannelNameLength: number = MAX_CHANNEL_NAME_LENGTH;
    protected channels: Channel[] = [];
    protected filteredChannels: Channel[] = [];

    constructor(
        private dialogRef: MatDialogRef<ChannelSearchComponent>,
        private authService: AuthService = inject(AuthService),
        private clientSocket: ClientSocketService,
    ) {}
    get username() {
        return this.authService.user?.username;
    }

    ngOnInit() {
        this.clientSocket.socket.emit('getChannels');
        this.clientSocket.socket.on('channelsList', (channels: Channel[]) => {
            this.channels = channels.filter((channel) => !channel.membersList.includes(this.username as string));
            this.filteredChannels = [...this.channels]; // Initialiser les canaux filtrés
        });
    }

    protected joinChannel(channel: Channel) {
        this.clientSocket.socket.emit('joinMembersList', channel.channelId, this.username, (response: { success: boolean }) => {
            if (response.success) {
                this.clientSocket.socket.emit('getChannels');
            } else {
                console.error('Failed to join the channel.');
            }
        });
        this.dialogRef.close();
    }

    protected close() {
        this.dialogRef.close();
    }
    protected onSearch(event: Event) {
        const searchTerm = (event.target as HTMLInputElement).value.toLowerCase();
        this.filteredChannels = this.channels.filter((channel) => channel.channelName.toLowerCase().includes(searchTerm));
    }
}
