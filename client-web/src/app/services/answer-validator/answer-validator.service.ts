import { Injectable, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Button } from '@app/constants/button-model';
import { BONUS_FACTOR, TIME_OUT } from '@app/constants/in-game';
import { SNACK_BAR_NORMAL_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { StatsService } from '@app/services/stats/stats.service';
import { TimerService } from '@app/services/timer/timer.service';
import { QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Answer, QreAnswer } from '@common/lobby';

@Injectable({
    providedIn: 'root',
})
export class AnswerValidatorService {
    // Service de validation des reponses
    isObserver: boolean = false;
    buttons: Button[] = [];
    rewardMessage: string = '';
    isProcessing: boolean = false;
    answerForm: FormControl = new FormControl('', { nonNullable: true });
    slideAnswerForm: FormControl = new FormControl(0, { nonNullable: true });
    bonusTimes: number = 0;
    hasBonus: boolean = false;
    exactSlideAnswer: boolean = false;
    grade: number | null = null;
    isAnswerCorrect: boolean = true;
    canLoadNextQuestion: boolean = false;
    hasQuestionEnded: boolean = false;
    isEvaluationPhase: boolean = false;
    qrlAnswers: Answer[] = [];
    private statsService: StatsService = inject(StatsService);
    private snackBar: MatSnackBar = inject(MatSnackBar);

    constructor(
        private gameService: GameHandlingService,
        private clientSocket: ClientSocketService,
        private timer: TimerService,
    ) {}

    submitAnswer(submittedFromTimer: boolean) {
        if (this.isProcessing) return;
        this.answerForm.disable();
        this.slideAnswerForm.disable();
        if (this.gameService.isCurrentQuestionQcm()) {
            let clickedChoicesCount = 0;
            let correctChoicesCount = 0;
            this.buttons.forEach((button) => {
                if (button.isCorrect) {
                    correctChoicesCount++;
                }

                if (button.selected) {
                    clickedChoicesCount++;
                    if (!button.isCorrect) this.isAnswerCorrect = false;
                }
            });

            if (clickedChoicesCount !== correctChoicesCount) this.isAnswerCorrect = false;
            this.isProcessing = true;
        } else if (this.gameService.isCurrentQuestionQre()) {
            const lowerBound = this.gameService.getCorrectAnswersForCurrentQuestionQRE()[0];
            const correctAnswer = this.gameService.getCorrectAnswersForCurrentQuestionQRE()[1];
            const upperBound = this.gameService.getCorrectAnswersForCurrentQuestionQRE()[2];
            const submittedAnswer = parseFloat(this.slideAnswerForm.value);

            this.isAnswerCorrect = submittedAnswer >= lowerBound && submittedAnswer <= upperBound;
            // Optionally, apply bonus if exactly correct
            if (submittedAnswer === correctAnswer) {
                this.exactSlideAnswer = true;
            }
            const qreAnswer: QreAnswer = {
                submitter: this.clientSocket.playerName,
                questionType: QuestionType.QRE,
                value: submittedAnswer,
            };

            this.clientSocket.socket.emit('qreAnswerSubmitted', qreAnswer, submittedFromTimer);
        }

        if (this.gameService.gameMode === GameMode.Testing) {
            this.timer.stopCountdown();
            this.processAnswer();
            return;
        }

        const answer: Answer = {
            submitter: this.clientSocket.playerName,
            ...(this.gameService.isCurrentQuestionQcm()
                ? { questionType: QuestionType.QCM, isCorrect: this.isAnswerCorrect }
                : this.gameService.isCurrentQuestionQre()
                ? { questionType: QuestionType.QRE, isCorrect: this.isAnswerCorrect }
                : { questionType: QuestionType.QRL, text: this.answerForm.value.trim() }),
            grade: null,
        };

        this.clientSocket.socket.emit('answerSubmitted', answer, submittedFromTimer);
    }

    processAnswer() {
        if (!this.isObserver) {
            let rewardedPoints = this.gameService.currentGame.questions[this.gameService.currentQuestionId].points;
            if (
                !this.gameService.isCurrentQuestionQcm() &&
                !this.gameService.isCurrentQuestionQre() &&
                this.gameService.gameMode === GameMode.RealGame
            ) {
                rewardedPoints *= this.grade as number;
                if (rewardedPoints === 0) this.isAnswerCorrect = false;
            }
            if (this.gameService.isCurrentQuestionQre() && this.exactSlideAnswer) {
                // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                rewardedPoints *= 1.2;
                if (rewardedPoints === 0) this.isAnswerCorrect = false;
            }

            if (this.isAnswerCorrect) {
                this.rewardMessage = `+${rewardedPoints} points ✅`;
                rewardedPoints += this.giveBonus(rewardedPoints);
                this.gameService.incrementScore(rewardedPoints);
                this.snackBar.open(this.rewardMessage, '', SNACK_BAR_NORMAL_CONFIGURATION);
            } else this.snackBar.open('+0 points ❌', '', SNACK_BAR_NORMAL_CONFIGURATION);

            this.saveReward(rewardedPoints);
            this.gameService.checkChallengeCompletion(this.isAnswerCorrect, this.answerForm.value.length, this.exactSlideAnswer);

            this.buttons.forEach((button) => {
                if (button.isCorrect) button.showCorrectButtons = true;
                if (!button.isCorrect) {
                    button.showWrongButtons = true;
                }
            });

            if (this.gameService.gameMode === GameMode.Testing) this.timer.startCountdown(TIME_OUT, { isQuestionTransition: true });
        }
    }
    prepareNextQuestion() {
        this.buttons.forEach((button) => {
            button.showCorrectButtons = false;
            button.showWrongButtons = false;
            button.selected = false;
        });
        this.rewardMessage = '';
        this.isProcessing = false;
        this.hasBonus = false;
        this.isAnswerCorrect = true;
        this.grade = null;
        this.hasQuestionEnded = false;
        this.canLoadNextQuestion = false;
        this.isEvaluationPhase = false;
        this.exactSlideAnswer = false;
        this.slideAnswerForm.reset();
        this.slideAnswerForm.enable();
        this.answerForm.reset();
        this.answerForm.enable();
    }

    reset() {
        this.prepareNextQuestion();
        this.qrlAnswers = [];
        this.buttons = [];
        this.bonusTimes = 0;
    }
    listenForQuestionEnd() {
        this.clientSocket.socket.off('qcmEnd');
        this.clientSocket.socket.off('qreEnd');
        this.clientSocket.socket.off('qrlEnd');
        this.clientSocket.socket.off('qrlResults');

        this.clientSocket.socket.on('qcmEnd', (bonusRecipient: string) => {
            this.hasQuestionEnded = true;
            if (this.clientSocket.isOrganizer) {
                this.timer.stopCountdown();
                this.canLoadNextQuestion = true;
                return;
            }
            if (this.clientSocket.socket.id === bonusRecipient) this.hasBonus = true;
            this.processAnswer();
        });

        this.clientSocket.socket.on('qreEnd', (bonusRecipient: string) => {
            this.hasQuestionEnded = true;
            if (this.clientSocket.isOrganizer) {
                this.timer.stopCountdown();
                this.canLoadNextQuestion = true;
                return;
            }
            if (this.clientSocket.socket.id === bonusRecipient) this.hasBonus = true;
            this.processAnswer();
        });

        this.clientSocket.socket.on('qrlEnd', (qrlAnswers: Answer[]) => {
            this.timer.stopCountdown();
            if (this.clientSocket.isOrganizer) this.qrlAnswers = qrlAnswers;
            this.isEvaluationPhase = true;
        });

        this.clientSocket.socket.on('qrlResults', (qrlAnswers: Answer[]) => {
            this.hasQuestionEnded = true;
            this.isEvaluationPhase = false;
            if (this.clientSocket.isOrganizer) {
                this.canLoadNextQuestion = true;
                return;
            }
            this.grade = (qrlAnswers.find((answer: Answer) => answer.submitter === this.clientSocket.playerName) as Answer).grade;
            this.processAnswer();
        });
    }

    private saveReward(rewardedPoints: number) {
        if (this.gameService.gameMode === GameMode.RealGame) this.statsService.saveReward(this.isAnswerCorrect, rewardedPoints);
    }

    private giveBonus(currentRewardedPoints: number) {
        let bonus = 0;
        if (
            (this.gameService.isCurrentQuestionQcm() || this.gameService.isCurrentQuestionQre()) &&
            (this.hasBonus || this.gameService.gameMode === GameMode.Testing)
        ) {
            if (this.exactSlideAnswer) {
                // eslint-disable-next-line @typescript-eslint/no-magic-numbers
                currentRewardedPoints /= 1.2;
            }
            bonus = currentRewardedPoints * BONUS_FACTOR;
            this.rewardMessage += ` + ${bonus} points bonus 🎉🎊`;
            this.bonusTimes++;
            this.clientSocket.socket.emit('updateBonusTimes', this.bonusTimes);
        }
        return bonus;
    }
}
