import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TOKEN } from '@app/constants/auth';
import { MAX_CHANNEL_NAME_LENGTH } from '@app/constants/chat';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { Badge, User } from '@common/user';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-create-channel-dialog',
    templateUrl: './create-channel-dialog.component.html',
    styleUrls: ['./create-channel-dialog.component.scss'],
})
export class CreateChannelDialogComponent {
    badges: Badge[] = [];
    protected channelForm: FormControl = new FormControl('', [Validators.required, this.mustBeFilled]);
    protected maxChannelNameLength: number = MAX_CHANNEL_NAME_LENGTH;

    // eslint-disable-next-line max-params
    constructor(
        private clientSocket: ClientSocketService,
        private dialogRef: MatDialogRef<CreateChannelDialogComponent>,
        private authService: AuthService,
        private http: HttpClient,
    ) {
        this.badges = this.authService.user?.badges ?? [];
    }

    get username() {
        return this.authService.user?.username;
    }

    protected createChannel() {
        const channelName = this.channelForm.value.trim();

        this.clientSocket.socket.emit('createChannel', channelName, (response: { success: boolean; channelId?: string }) => {
            if (response.success && response.channelId) {
                this.clientSocket.socket.emit('joinMembersList', response.channelId, this.username, (joinResponse: { success: boolean }) => {
                    if (joinResponse.success) {
                        this.clientSocket.socket.emit('getChannels');
                        this.updateBadgeProgress('channel-create');
                    } else {
                        // console.error('Error joining the channel after creation');
                    }
                });
            } else {
                // console.error('Error creating channel');
            }
        });

        this.dialogRef.close();
    }

    protected cancel() {
        this.dialogRef.close();
    }

    private mustBeFilled(formControl: AbstractControl) {
        const isEmailFilled = formControl.value.trim() !== '';
        if (isEmailFilled) return null; // Valid, no errors
        return { notFilled: true }; // Invalid, error object
    }
    private setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }
    private updateBadgeProgress(badgeId: string): void {
        const user = this.authService.user;
        if (!user) return;

        const badge = user.badges.find((b) => b.id === badgeId);
        if (badge && badge.userProgress < badge.goal) {
            badge.userProgress += 1;

            const url = `${environment.serverBaseUrl}/api/users/${user.id}/badges/${badgeId}`;
            this.http.patch<User>(url, { userProgress: badge.userProgress }, this.setAuthorizationHeader()).subscribe({
                next: (updatedUser) => {
                    this.authService.user = updatedUser;
                    this.badges = updatedUser.badges;
                },
            });
        }
    }
}
