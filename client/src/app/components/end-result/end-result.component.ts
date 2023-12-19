import { Component, OnDestroy, OnInit } from '@angular/core';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { LobbyDetails, Player } from '@common/lobby';
@Component({
    selector: 'app-end-result',
    templateUrl: './end-result.component.html',
    styleUrls: ['./end-result.component.scss'],
})
export class EndResultComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    currentQuestion: string = '';
    correctAnswers: string[];
    allHistogramData: { [questionId: number]: { [key: string]: number } } = {};
    currentQuestionId: number = 0;

    constructor(
        private clientSocket: ClientSocketService,
        private gameService: GameHandlingService,
    ) {}

    ngOnInit(): void {
        this.configureBaseSocketFeatures();
        this.clientSocket.socket.emit('getPlayers');
        this.allHistogramData = this.gameService.getAllHistogramData();
        this.updateCurrentQuestionText();
        this.gameService.resetHistogramDataForQuestion();
        this.gameService.setCurrentQuestionId(this.currentQuestionId);
        this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
    }

    updateCurrentQuestionText(): void {
        this.currentQuestion = this.gameService.currentGame.questions[this.currentQuestionId].text;
    }

    previousQuestion(): void {
        if (this.currentQuestionId >= 1) {
            this.currentQuestionId--;
            this.gameService.setCurrentQuestionId(this.currentQuestionId);
            this.updateCurrentQuestionText();
            this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
        }
    }

    nextQuestion(): void {
        const maxQuestionId = --Object.keys(this.allHistogramData).length;
        if (this.currentQuestionId < maxQuestionId) {
            this.currentQuestionId++;
            this.gameService.setCurrentQuestionId(this.currentQuestionId);
            this.updateCurrentQuestionText();
            this.correctAnswers = this.gameService.getCorrectAnswersForCurrentQuestion();
        }
    }

    ngOnDestroy(): void {
        this.clientSocket.socket.removeAllListeners('latestPlayerList');
    }

    configureBaseSocketFeatures() {
        this.clientSocket.socket.on('latestPlayerList', (lobbyDetails: LobbyDetails) => {
            if (!this.players.length) this.players = lobbyDetails.players;
        });
    }
}
