import { Component, Input } from '@angular/core';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';

@Component({
    selector: 'app-histogram',
    templateUrl: './histogram.component.html',
    styleUrls: ['./histogram.component.scss'],
})
export class HistogramComponent {
    @Input() data: { [key: string]: number };
    @Input() correctAnswers: string[];
    object = Object;

    constructor(private gameHandler: GameHandlingService) {}
    get isCurrentQuestionQcm(): boolean {
        return this.gameHandler.isCurrentQuestionQcm();
    }
}
