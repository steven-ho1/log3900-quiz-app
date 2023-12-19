import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Message } from '@common/lobby';
const SCROLL_SENSITIVITY = 5;
const MESSAGE_TIMEOUT = 5;

@Component({
    selector: 'app-chat-box',
    templateUrl: './chat-box.component.html',
    styleUrls: ['./chat-box.component.scss'],
})
export class ChatBoxComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('messagesContainer') private messagesContainer: ElementRef;
    newMessage: string = '';
    chat: Message[] = [];
    private snackBar: MatSnackBar = inject(MatSnackBar);
    constructor(
        private clientSocket: ClientSocketService,
        private gameHandler: GameHandlingService,
    ) {}

    ngOnInit() {
        this.configureBaseSocketFeatures();
        this.clientSocket.socket.emit('getChat', this.gameHandler.gameMode);
    }

    ngOnDestroy() {
        this.clientSocket.socket.removeAllListeners('messageReceived');
        this.clientSocket.socket.removeAllListeners('PlayerMuted');
        this.clientSocket.socket.removeAllListeners('PlayerUnmuted');
    }
    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('messageReceived', (chat: Message[]) => {
            this.chat = chat;
            this.scrollChatBottom();
        });
        this.clientSocket.socket.on('PlayerMuted', () => {
            this.snackBar.open('Vous ne pouvez plus clavarder ❌', '', SNACK_BAR_NORMAL_CONFIGURATION);
        });
        this.clientSocket.socket.on('PlayerUnmuted', () => {
            this.snackBar.open('Vous pouvez maintenant clavarder ✅', '', SNACK_BAR_NORMAL_CONFIGURATION);
        });
    }

    ngAfterViewInit() {
        this.scrollChatBottom();
    }

    sendMessage() {
        if (this.newMessage.trim().length > 0) {
            const messageData = {
                sender: this.clientSocket.socket.id,
                content: this.newMessage,
                time: new Date().toString(),
            };
            this.clientSocket.socket.emit('chatMessage', messageData);
            this.newMessage = '';
        }
    }
    scrollChatBottom() {
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
}
