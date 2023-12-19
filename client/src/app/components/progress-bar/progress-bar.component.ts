import { Component, OnInit } from '@angular/core';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from '@app/services/timer/timer.service';
import { GameMode } from '@common/game-mode';

@Component({
    selector: 'app-progress-bar',
    templateUrl: './progress-bar.component.html',
    styleUrls: ['./progress-bar.component.scss'],
})
export class ProgressBarComponent implements OnInit {
    constructor(
        private timer: TimerService,
        private gameService: GameHandlingService,
        private clientsocket: ClientSocketService,
    ) {}

    get count(): number {
        return this.timer.count;
    }

    get isPanicModeEnabled(): boolean {
        return this.timer.isPanicModeEnabled;
    }

    get isCountdownRunning(): boolean {
        return this.timer.isCountdownRunning;
    }

    get currentQuestionDuration(): number {
        return this.gameService.getCurrentQuestionDuration();
    }

    ngOnInit() {
        if (this.clientsocket.isOrganizer || this.gameService.gameMode === GameMode.Testing) this.timer.startCountdown(this.currentQuestionDuration);
    }
}
