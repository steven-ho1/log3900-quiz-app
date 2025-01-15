/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable max-lines */
/* eslint-disable no-console */
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, inject, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ChannelSearchComponent } from '@app/components/chat-components/channel-search/channel-search.component';
import { CreateChannelDialogComponent } from '@app/components/chat-components/create-channel-dialog/create-channel-dialog.component';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { TOKEN } from '@app/constants/auth';
import { SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { Channel } from '@common/channel';
import { CHAT_IMAGE_MAX_SIZE_BYTES, ORIENTATION, QUALITY, RATIO, VALID_FILE_TYPES } from '@common/item';
import { Message } from '@common/message';
import { Language, User, UserReference } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { NgxImageCompressService } from 'ngx-image-compress';

const SCROLL_SENSITIVITY = 5;
const MESSAGE_TIMEOUT = 5;
const MAX_RECORDING_DURATION = 10;
const SECOND_MS = 1000;
const dialogConfig: MatDialogConfig = {
    backdropClass: 'backdropBackground',
    disableClose: true,
};
@Component({
    selector: 'app-chat-box',
    templateUrl: './chat-box.component.html',
    styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent implements OnInit, OnDestroy, AfterViewInit {
    @Output() detached = new EventEmitter<boolean>();
    @ViewChild('imageUploadInput', { static: false }) imageUploadInput: ElementRef;
    @ViewChild('messagesContainer') private messagesContainer: ElementRef;
    @ViewChild('audioMessage') private audioMessage: ElementRef;
    protected newMessage: FormControl = new FormControl('', [Validators.required, this.noWhitespaceValidator]);
    protected chat: Message[] = [];
    protected originalChat: Message[] = [];
    protected channels: Channel[] = [];
    protected selectedChannelId: string = 'Global';
    protected userId: string | undefined;
    protected showMore: boolean = false;
    protected selectedChannelIndex: number = 0;
    protected isLoading: boolean = true;
    protected isMaximized: boolean = true;
    protected isDetached: boolean = false;
    protected isElectron: boolean = false;
    protected fileName: string = '';
    protected imageUrl: string | null = null;
    protected audioUrl: string | null = null;
    protected errorMessage: string = '';
    protected canSend: boolean = true;
    protected recording = false;
    protected timeLeft: number = MAX_RECORDING_DURATION;
    protected currentLanguage: string;
    protected ingameChannelId: string = '';

    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private timer: number;
    private snackBar: MatSnackBar = inject(MatSnackBar);
    private authService: AuthService = inject(AuthService);
    private dialog: MatDialog = inject(MatDialog);
    private router: Router = inject(Router);
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private clientSocket: ClientSocketService,
        private imageCompress: NgxImageCompressService,
        private cdr: ChangeDetectorRef,
    ) {
        if (this.router.url === '/chat') {
            this.isDetached = true;
        }

        if (window.electron) {
            this.isElectron = true;

            window.electron.ipcRenderer.on('user-change', (user) => {
                this.authService.user = user as User;
            });
        }
        this.initializeMediaRecorder();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get username() {
        return this.authService.user?.username;
    }

    get avatar() {
        return this.authService.user?.avatar;
    }

    get isSocketConnected() {
        return this.clientSocket.isSocketAlive();
    }

    get isReadyToReceive() {
        return this.isSocketConnected && this.clientSocket.socket.hasListeners('messageReceived');
    }

    get currentChannelName() {
        const selectedChannel = this.channels.find((channel: Channel) => channel.channelId === this.selectedChannelId);
        return selectedChannel?.channelName ?? 'Global';
    }

    ngOnInit() {
        this.configureBaseSocketFeatures();
        this.userId = this.authService.user?.id;
        this.selectedChannelId = 'Global';
        this.clientSocket.socket.emit('joinMembersList', this.selectedChannelId, this.username);

        this.clientSocket.socket.emit('joinChannel', 'Global', this.username, (response: { success: boolean; error?: string }) => {
            if (response.success) {
                this.setMessageReceiver();
                console.log('test');
            } else {
                console.error('Error joining Global channel:', response.error);
            }
        });
        this.clientSocket.socket.emit('getChannels');
    }

    ngOnDestroy() {
        this.clientSocket.socket.removeAllListeners('messageReceived');
        this.clientSocket.socket.removeAllListeners('messagesFetch');
        this.clientSocket.socket.removeAllListeners('channelsList');
        this.clientSocket.socket.removeAllListeners('channelDeleted');
        this.clientSocket.socket.removeAllListeners('PlayerMuted');
        this.clientSocket.socket.removeAllListeners('PlayerUnmuted');
        this.clientSocket.socket.removeAllListeners('channelCreated');
        this.clientSocket.socket.removeAllListeners('reconnect');
        this.clientSocket.socket.removeAllListeners('serverRestarted');
        this.clientSocket.socket.emit('leaveChannel', this.selectedChannelId, this.username);
    }

    ngAfterViewInit() {
        this.scrollChatBottom();
    }

    protected getAvatarImage(avatarUrl: string) {
        return this.authService.getAvatarImage(avatarUrl);
    }

    protected openChannelSearchDialog() {
        const dialogRef = this.dialog.open(ChannelSearchComponent, dialogConfig);
        console.log(dialogRef); // TODO supprimer et faire la suite
        // dialogRef.afterClosed().subscribe((result) => {});
    }

    protected openCreateChannelDialog() {
        const dialogRef = this.dialog.open(CreateChannelDialogComponent, dialogConfig);

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                // this.clientSocket.socket.emit('createChannel', result);
                // this.clientSocket.socket.emit('joinMembersList', result, this.username);
            }
        });
    }

    protected toggleMaximization() {
        this.isMaximized = !this.isMaximized;
        this.scrollChatBottom();
        this.cdr.detectChanges();
    }

    protected detachChat() {
        if (this.isElectron) {
            this.isDetached = true;
            this.detached.emit(true);
            window.electron.ipcRenderer.send('detach-chat', sessionStorage.getItem(TOKEN)!);
        }
    }

    protected configureBaseSocketFeatures() {
        this.clientSocket.socket.on('messagesFetch', (messages: Message[]) => {
            this.isLoading = false;
            this.originalChat = messages;
            this.chat = messages.map((message) => {
                const isBlocked =
                    this.authService.user?.blockedPlayers.some((player) => player.id === message.senderId) ||
                    this.authService.user?.blockedBy.some((player) => player.id === message.senderId);

                if (isBlocked) {
                    return {
                        ...message,
                        sender: this.currentLanguage === Language.French ? '[Utilisateur bloqué]' : '[Blocked User]',
                        content: this.currentLanguage === Language.French ? '[Message caché]' : '[Hidden message]',
                        imageUrl: undefined,
                        audioUrl: undefined,
                    };
                }

                return message;
            });
            this.scrollChatBottom();
            this.cdr.detectChanges();
        });
        this.clientSocket.socket.on('channelsList', (channels: Channel[]) => {
            const userChannels = channels.filter((channel) => channel.membersList.includes(this.username!));

            const gameChannel = this.channels.find((channel) => channel.channelId === this.ingameChannelId);
            if (gameChannel) this.channels = [gameChannel, ...userChannels];
            else this.channels = userChannels;

            this.updateVisibleChannels();
            this.cdr.detectChanges();
        });
        this.clientSocket.socket.on('channelDeleted', (channelId: string) => {
            this.channels = this.channels.filter((channel) => channel.channelId !== channelId);
            this.updateVisibleChannels();
            if (this.selectedChannelId === channelId) {
                this.selectedChannelId = 'Global';
                this.clientSocket.socket.emit('getChat', 'Global');
            }
            this.cdr.detectChanges();
        });

        this.clientSocket.socket.on('PlayerMuted', () => {
            this.snackBar.open(
                this.translate.currentLang === Language.French ? 'Vous avez été mis en sourdine ❌' : 'You have been muted ❌',
                '',
                SNACK_BAR_NORMAL_CONFIGURATION,
            );
            this.canSend = true;
        });

        this.clientSocket.socket.on('channelCreated', (newChannel: Channel, isIngameChannel: boolean) => {
            if (isIngameChannel) this.ingameChannelId = newChannel.channelId;

            this.channels.push(newChannel);
            this.updateVisibleChannels();
            this.cdr.detectChanges();
        });
        this.clientSocket.socket.on('reconnect', () => {
            // Si on perd internet
            console.log('Reconnected after internet loss');
            this.switchChannel(this.selectedChannelId);
            this.clientSocket.socket.emit('getChannels');
            this.cdr.detectChanges();
        });
        this.clientSocket.socket.on('serverRestarted', () => {
            console.log('Reconnected after server restart');
            this.switchChannel(this.selectedChannelId);
            this.clientSocket.socket.emit('getChannels');
            this.cdr.detectChanges();
        });
        this.clientSocket.socket.on('allUsers', (allusers: User[]) => {
            const currentUser = allusers.find((user) => user.id === this.authService.user?.id);
            const blockedUsers = currentUser?.blockedPlayers || [];
            const blockedBy = currentUser?.blockedBy || [];
            const blockedIds = new Set([...blockedUsers.map((user: UserReference) => user.id), ...blockedBy.map((user) => user.id)]);
            this.chat = this.originalChat.map((message) => {
                if (blockedIds.has(message.senderId)) {
                    return {
                        ...message,
                        sender: this.currentLanguage === Language.French ? '[Utilisateur bloqué]' : '[Blocked User]',
                        content: this.currentLanguage === Language.French ? '[Message masqué]' : '[Hidden message]',
                        imageUrl: undefined,
                        audioUrl: undefined,
                    };
                }
                return message;
            });
            this.cdr.detectChanges();
        });
    }
    protected updateVisibleChannels() {
        const globalChannel = this.channels.find((channel) => channel.channelId === 'Global');
        const ingameChannel = this.channels.find((channel) => channel.channelId === this.ingameChannelId);

        const sortedChannels = this.channels.filter((channel) => channel.channelId !== 'Global' && channel.channelId !== this.ingameChannelId);

        if (ingameChannel) sortedChannels.unshift(ingameChannel);

        if (globalChannel) {
            sortedChannels.unshift(globalChannel);
        }

        this.channels = sortedChannels;
    }
    protected sendMessage() {
        const messageData: Message = {
            senderId: this.userId as string,
            sender: this.username as string,
            avatar: this.avatar as string,
            channelId: this.selectedChannelId,
        };

        if (this.newMessage.valid) messageData.content = this.newMessage.value;
        if (this.imageUrl) messageData.imageUrl = this.imageUrl;
        if (this.audioUrl) messageData.audioUrl = this.audioUrl;

        this.canSend = false;
        this.clientSocket.socket.emit('chatMessage', messageData);

        this.newMessage.reset('');
        this.removeAudio();
        this.removeImage();
    }

    protected onEnded() {
        // Because icon doesn't change
        this.audioMessage.nativeElement.pause();
        this.cdr.detectChanges();
    }

    protected scrollChatBottom() {
        if (this.messagesContainer) {
            const chatComponent = this.messagesContainer.nativeElement;
            const isChatAtBottom = chatComponent.scrollHeight - chatComponent.scrollTop - chatComponent.clientHeight < SCROLL_SENSITIVITY;
            setTimeout(() => {
                // timeout car sinon la fonction s'execute avant l'arriver des messages
                if (isChatAtBottom) {
                    chatComponent.scrollTop = chatComponent.scrollHeight;
                }
            }, MESSAGE_TIMEOUT);
        }
    }

    protected deleteChannel() {
        const dialogRef = this.dialog.open(ConfirmationPopupComponent, {
            data: {
                title: this.currentLanguage === Language.French ? 'Supprimer le canal' : 'Delete the channel',
                description:
                    this.currentLanguage === Language.French
                        ? `Voulez-vous vraiment supprimer le canal ${this.currentChannelName}?`
                        : `Do you really want to delete the channel ${this.currentChannelName}?`,
                primaryAction: this.currentLanguage === Language.French ? 'Supprimer' : 'Delete',
            },
        });
        dialogRef.afterClosed().subscribe((confirmed) => {
            if (confirmed) {
                this.clientSocket.socket.emit('deleteChannel', this.selectedChannelId, (response: unknown) => {
                    const typedResponse = response as { success: boolean; error?: string };
                    if (typedResponse.success) {
                        this.channels = this.channels.filter((channel) => channel.channelId !== this.selectedChannelId);
                        if (!this.channels.find((channel) => channel.channelId === 'Global')) {
                            this.channels.push({ channelId: 'Global', channelName: 'Global', members: [], membersList: [] });
                        }
                        this.updateVisibleChannels();
                        this.selectedChannelId = 'Global';
                        this.clientSocket.socket.emit('getChat', 'Global');
                    } else {
                        console.error(typedResponse.error || 'Failed to delete channel');
                    }
                });
            }
        });
    }

    protected noWhitespaceValidator(control: AbstractControl) {
        const isWhitespace = (control.value || '').trim().length === 0;
        return isWhitespace ? { whitespace: true } : null;
    }

    protected switchChannel(channelId: string) {
        this.clientSocket.socket.removeAllListeners('messageReceived');

        this.isLoading = true;
        this.leaveCurrentChannel()
            .then(async () => {
                return this.joinNewChannel(channelId);
            })
            .then(() => {
                this.selectedChannelId = channelId;
                this.setMessageReceiver();
                this.cdr.detectChanges();
            })
            .catch((error) => {
                console.error('Error during channel switch:', error);
                this.isLoading = false;
            });
    }

    protected onImageUpload() {
        if (this.imageUploadInput.nativeElement.files && this.imageUploadInput.nativeElement.files.length > 0) {
            const file = this.imageUploadInput.nativeElement.files[0];

            if (!VALID_FILE_TYPES.includes(file.type)) {
                this.errorMessage = this.currentLanguage === Language.French ? 'Format non accepté!' : 'Unsupported format!';
                return;
            }

            if (file.size > CHAT_IMAGE_MAX_SIZE_BYTES) {
                this.errorMessage = this.currentLanguage === Language.French ? 'Fichier volumineux!' : 'File is too large!';
                return;
            }

            this.errorMessage = '';
            const reader = new FileReader();
            /*
                An event handler is assigned to the onload event of the FileReader instance.
                This event is triggered when the file reading operation is successfully completed (after calling readAsDataURL method)
            */
            reader.onload = (e) => {
                this.imageUrl = e.target?.result as string;

                this.imageCompress.compressFile(this.imageUrl, ORIENTATION, RATIO, QUALITY).then((result) => {
                    this.imageUrl = result; // result is the compressed base64 string
                    this.fileName = file.name;
                });
            };

            /*
                FileReader reads the file and the result is a Data URL, which is a string that represents the file's data encoded in base64 format 
                and can be used as a source for an <img> tag or as a background image in CSS.
            */
            reader.readAsDataURL(file);
        }
    }

    protected removeImage() {
        this.imageUploadInput.nativeElement.value = '';
        this.imageUrl = null;
        this.fileName = '';
        this.errorMessage = '';
    }

    protected removeAudio() {
        this.audioUrl = null;
    }
    protected leaveMembers() {
        if (this.selectedChannelId === 'Global') {
            return; // L'utilisateur ne peut pas quitter le canal Global
        }
        const dialogRef = this.dialog.open(ConfirmationPopupComponent, {
            data: {
                title: this.currentLanguage === Language.French ? 'Quitter le canal' : 'Leave the channel',
                description:
                    this.currentLanguage === Language.French
                        ? `Voulez-vous vraiment quitter le canal ${this.currentChannelName}?`
                        : `Do you really want to leave the channel ${this.currentChannelName}?`,
                primaryAction: this.currentLanguage === Language.French ? 'Quitter' : 'Leave',
            },
        });
        dialogRef.afterClosed().subscribe((confirmed) => {
            if (confirmed) {
                this.clientSocket.socket.emit(
                    'removeFromMembersList',
                    this.selectedChannelId,
                    this.username,
                    (response: { success: boolean; error?: string }) => {
                        if (response.success) {
                            console.log(`Successfully left channel: ${this.selectedChannelId}`);
                            this.selectedChannelId = 'Global';
                            this.clientSocket.socket.emit('getUserChannels', this.username); // Mise à jour des canaux
                            this.clientSocket.socket.emit('getChannels');
                            this.clientSocket.socket.emit('getChat', 'Global');
                        } else {
                            console.error(response.error || 'Failed to leave channel');
                        }
                    },
                );
            }
        });
    }

    protected startRecording() {
        this.removeAudio();
        if (this.mediaRecorder) {
            this.recording = true;
            this.timeLeft = MAX_RECORDING_DURATION;
            this.mediaRecorder.start();

            this.timer = window.setInterval(() => {
                if (this.timeLeft > 0) {
                    this.timeLeft--;
                } else {
                    this.stopRecording();
                }
            }, SECOND_MS);
        }
    }

    protected stopRecording() {
        if (this.mediaRecorder && this.recording) {
            this.mediaRecorder.stop();
            this.recording = false;
        }
    }

    private setMessageReceiver() {
        this.clientSocket.socket.off('messageReceived');
        this.clientSocket.socket.on('messageReceived', (message: Message) => {
            this.canSend = true;
            this.originalChat.push(message);

            // Verification si le user est block
            const isBlocked =
                this.authService.user?.blockedPlayers.some((player) => player.id === message.senderId) ||
                this.authService.user?.blockedBy.some((player) => player.id === message.senderId);
            if (isBlocked) {
                message.sender = this.currentLanguage === Language.French ? '[Utilisateur bloqué]' : '[Blocked User]';
                message.content = this.currentLanguage === Language.French ? '[Message masqué]' : '[Hidden message]';
            }

            this.chat.push(message);
            this.scrollChatBottom();
            this.cdr.detectChanges();
        });
        this.cdr.detectChanges();
    }

    private async leaveCurrentChannel(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.clientSocket.socket.emit('leaveChannel', this.selectedChannelId, this.username, (response: unknown) => {
                const typedResponse = response as { success: boolean; error?: string };
                if (typedResponse.success) {
                    resolve();
                } else {
                    reject(typedResponse.error || 'Failed to leave channel');
                }
            });
        });
    }

    private async joinNewChannel(channelId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.clientSocket.socket.emit('joinChannel', channelId, this.username, (response: unknown) => {
                // this.selectedChannelId = channelId;
                const typedResponse = response as { success: boolean; error?: string };
                if (typedResponse.success) {
                    this.selectedChannelId = channelId;
                    // this.clientSocket.socket.emit('getChannels');
                    resolve();
                } else {
                    reject(typedResponse.error || 'Failed to join channel');
                }
            });
        });
    }

    private async initializeMediaRecorder() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            clearInterval(this.timer);
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            this.audioChunks = [];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.audioUrl = e.target?.result as string;
                this.cdr.detectChanges();
            };
            reader.readAsDataURL(audioBlob);
        };
    }
}
