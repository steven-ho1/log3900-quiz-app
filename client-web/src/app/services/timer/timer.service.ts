import { Injectable } from '@angular/core';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerConfiguration } from '@common/timer';
import { Language } from '@common/user';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root',
})
export class TimerService {
    count: number = 0;
    transitionCount: number = 0;
    transitionMessage: string = '';
    isQuestionTransition: boolean = false;
    isPanicModeEnabled: boolean = false;
    isCountdownRunning: boolean = false;
    currentLanguage: string;

    constructor(
        private clientSocket: ClientSocketService,
        private gameHandler: GameHandlingService,
        private translate: TranslateService,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    listenForCountdown() {
        this.clientSocket.socket.off('countdown');
        this.clientSocket.socket.off('questionTransition');
        this.clientSocket.socket.off('countdownStarted');
        this.clientSocket.socket.off('countdownStopped');

        this.clientSocket.socket.on('countdown', (newCount: number) => {
            if (this.isQuestionTransition) {
                this.transitionCount = newCount;
                return;
            }
            this.count = newCount;
        });

        this.clientSocket.socket.on('questionTransition', (isQuestionTransition: boolean) => {
            this.isQuestionTransition = isQuestionTransition;
            this.isPanicModeEnabled = false;

            let nextQuestionMessage = '';
            if (this.gameHandler.currentQuestionId === this.gameHandler.currentGame.questions.length - 1)
                nextQuestionMessage = this.currentLanguage === Language.French ? 'Résultats dans' : 'Results in';
            else nextQuestionMessage = this.currentLanguage === Language.French ? 'Prochaine question dans' : 'Next question in';
            this.transitionMessage = nextQuestionMessage;
        });

        this.clientSocket.socket.on('countdownStarted', () => {
            this.isCountdownRunning = true;
        });

        this.clientSocket.socket.on('countdownStopped', () => {
            this.isCountdownRunning = false;
        });
    }

    startCountdown(initialCount: number, configuration?: TimerConfiguration) {
        configuration = { isQuestionTransition: false, isPanicModeEnabled: false, isInputInactivityCountdown: false, ...configuration };
        this.clientSocket.socket.emit('startCountdown', initialCount, configuration, this.gameHandler.gameMode);
    }

    stopCountdown() {
        this.clientSocket.socket.emit('stopCountdown');
    }

    reset() {
        this.stopCountdown();
        this.count = 0;
        this.transitionCount = 0;
        this.isQuestionTransition = false;
        this.isPanicModeEnabled = false;
        this.isCountdownRunning = false;
    }
}
