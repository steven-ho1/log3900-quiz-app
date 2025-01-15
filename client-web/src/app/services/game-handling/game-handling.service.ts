/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-magic-numbers */
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TOKEN } from '@app/constants/auth';
import { ErrorMessage } from '@app/constants/error-message';
import { QRL_DURATION } from '@app/constants/in-game';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { S_MS_CONVERSION } from '@app/services/stats/stats.service';
import { Game, GameInfo, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Challenge } from '@common/stats';
import { User } from '@common/user';
import { StatusCodes } from 'http-status-codes';
import { Observable, throwError } from 'rxjs';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class GameHandlingService {
    // Service qui s'occupe des jeux questionnaires
    challengeStartTime: number | undefined;
    challengeEndTime: number | undefined;
    totalVictoryPrize: number = 0;
    challenge: Challenge | undefined;
    allQcmAnswersCorrect: boolean = true;
    currentGame: Game;
    gameMode: GameMode = GameMode.RealGame;
    currentQuestionId: number = 0;
    scoreSource = new BehaviorSubject<number>(0);
    score$ = this.scoreSource.asObservable();
    currentQuestionSource = new BehaviorSubject<string>('');
    currentQuestion$ = this.currentQuestionSource.asObservable();
    private allHistogramData: { [questionId: number]: { [key: string]: number } } = {};
    private readonly baseUrl: string = environment.serverGamesUrl;

    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
    ) {}

    getChallenge() {
        return this.http
            .get<Challenge>(`${this.baseUrl}/${this.currentGame.id}/challenge`, this.setAuthorizationHeader())
            .pipe(catchError(this.handleError));
    }

    startChallengeTimer() {
        this.challengeStartTime = new Date().getTime();
    }

    stopChallengeTimer() {
        this.challengeEndTime = new Date().getTime();
    }

    // eslint-disable-next-line complexity
    checkChallengeCompletion(isAnswerCorrect: boolean, answerLength: number, exactSlideAnswer: boolean) {
        const currentQuestionType: QuestionType = this.currentGame.questions[this.currentQuestionId].type;
        const timeTakenSec = ((this.challengeEndTime as number) - (this.challengeStartTime as number)) / S_MS_CONVERSION;
        console.log('time taken', timeTakenSec);
        console.log('answer Length', answerLength);
        console.log('exact Slide', exactSlideAnswer);

        if (isAnswerCorrect) {
            switch (currentQuestionType) {
                case QuestionType.QCM:
                    if (this.challenge?.id === '1' && timeTakenSec <= 5) this.challenge.isCompleted = true;
                    else if (this.challenge?.id === '2' && this.allQcmAnswersCorrect) this.challenge.isCompleted = true;
                    break;
                case QuestionType.QRL:
                    if (this.challenge?.id === '3' && timeTakenSec <= 20) this.challenge.isCompleted = true;
                    else if (this.challenge?.id === '4' && answerLength <= 50) this.challenge.isCompleted = true;
                    break;
                case QuestionType.QRE:
                    if (this.challenge?.id === '5' && exactSlideAnswer) this.challenge.isCompleted = true;
                    break;
            }
        } else {
            switch (currentQuestionType) {
                case QuestionType.QCM:
                    if (this.challenge?.id === '2') {
                        this.challenge.isCompleted = false;
                        this.allQcmAnswersCorrect = false;
                    }
                    break;
                case QuestionType.QRL:
                    break;
                case QuestionType.QRE:
                    break;
            }
        }
    }

    purchaseHint() {
        const hintCost = this.totalVictoryPrize / 2;
        return this.http.post<User>(`${this.baseUrl}/hint`, { hintCost }, this.setAuthorizationHeader()).pipe(catchError(this.handleError));
    }

    getGames(): Observable<Game[]> {
        return this.http.get<Game[]>(this.baseUrl).pipe(catchError(this.handleError));
    }

    modifyGame(game: Game): Observable<Game[]> {
        return this.http.patch<Game[]>(`${this.baseUrl}/${game.id}`, game).pipe(catchError(this.handleError));
    }

    addGame(newGame: Game): Observable<Game[]> {
        return this.http.post<Game[]>(this.baseUrl, newGame).pipe(catchError(this.handleError));
    }

    changeVisibility(game: Game): Observable<Game[]> {
        return this.http.patch<Game[]>(`${this.baseUrl}/${game.id}/visibility`, { isVisible: game.isVisible }).pipe(catchError(this.handleError));
    }

    changePublicState(game: Game): Observable<Game[]> {
        return this.http.patch<Game[]>(`${this.baseUrl}/${game.id}/public-state`, { isPublic: game.isPublic }).pipe(catchError(this.handleError));
    }

    export(id: string) {
        return this.http.get<Game>(`${this.baseUrl}/${id}`, { responseType: 'json' }).pipe(catchError(this.handleError));
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(this.handleError));
    }

    getCurrentGamePublicState(gameId: string): Observable<boolean> {
        return this.http.get<Game>(`${this.baseUrl}/${gameId}`).pipe(
            map((game: Game) => game.isPublic),
            catchError(this.handleError),
        );
    }

    setCurrentQuestion(question: string): void {
        this.currentQuestionSource.next(question);
    }

    getCurrentQuestionDuration() {
        if (this.currentGame.questions[this.currentQuestionId].type === QuestionType.QCM) return this.currentGame.duration;
        else return QRL_DURATION;
    }

    setScore(newScore: number): void {
        this.scoreSource.next(newScore);
    }

    setCurrentQuestionId(id: number) {
        this.currentQuestionId = id;
    }

    incrementScore(amount: number): void {
        const newScore = this.scoreSource.value + amount;
        this.scoreSource.next(newScore);
    }

    verifyAdminPassword(password: string): Observable<boolean> {
        return this.http
            .post<{ valid: boolean }>(`${environment.serverAdminUrl}/verify-admin-password`, { password })
            .pipe(map((response) => response.valid));
    }

    getHistory(): Observable<GameInfo[]> {
        return this.http.get<GameInfo[]>(`${environment.serverBaseUrl}/api/history`).pipe(catchError(this.handleError));
    }

    resetHistory(): Observable<void> {
        return this.http.delete<void>(`${environment.serverBaseUrl}/api/history`).pipe(catchError(this.handleError));
    }
    resetHistogramDataForQuestion(): void {
        this.allHistogramData = {};
    }

    updateHistogramDataForQuestion(questionId: number, newData: { [key: string]: number }): void {
        this.allHistogramData[questionId] = {
            ...(this.allHistogramData[questionId] || {}),
            ...newData,
        };
    }
    getAllHistogramData(): { [questionId: number]: { [key: string]: number } } {
        return this.allHistogramData;
    }

    getCorrectAnswersForCurrentQuestion(): string[] {
        const currentQuestion = this.currentGame.questions[this.currentQuestionId];
        if (currentQuestion.choices) {
            const correctChoices = currentQuestion.choices.filter((choice) => choice.isCorrect);
            return correctChoices.map((choice) => choice.text);
        }
        return [];
    }
    getCorrectAnswersForCurrentQuestionQRE(): number[] {
        const currentQuestion = this.currentGame.questions[this.currentQuestionId];

        if (currentQuestion.correctSlideAnswer !== undefined && currentQuestion.toleranceMargin !== undefined) {
            const lowerBound = currentQuestion.correctSlideAnswer - currentQuestion.toleranceMargin;
            const exactAnswer = currentQuestion.correctSlideAnswer;
            const upperBound = currentQuestion.correctSlideAnswer + currentQuestion.toleranceMargin;

            return [lowerBound, exactAnswer, upperBound, currentQuestion.toleranceMargin];
        }

        return [];
    }
    isCurrentQuestionQcm() {
        return this.currentGame.questions[this.currentQuestionId].type === QuestionType.QCM;
    }
    isCurrentQuestionQre() {
        return this.currentGame.questions[this.currentQuestionId].type === QuestionType.QRE;
    }

    resetInGameData() {
        this.totalVictoryPrize = 0;
        this.challenge = undefined;
        this.challengeStartTime = undefined;
        this.challengeEndTime = undefined;
        this.allQcmAnswersCorrect = true;
    }
    updateGame(gameId: string, updatedData: Partial<Game>): Observable<Game> {
        const url = `${this.baseUrl}/${gameId}`;
        return this.http.patch<Game>(url, updatedData, this.setAuthorizationHeader()).pipe(catchError(this.handleError));
    }

    private setAuthorizationHeader() {
        const token = sessionStorage.getItem(TOKEN);
        const headers = new HttpHeaders({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            Authorization: `Bearer ${token}`,
        });

        return { headers };
    }

    // arrow function to avoid losing "this" context
    private handleError = (error: HttpErrorResponse) => {
        // Network error
        if (error.error instanceof ProgressEvent) {
            this.snackBar.open(ErrorMessage.NetworkError, '', SNACK_BAR_ERROR_CONFIGURATION);
        } else if (error.status === StatusCodes.INTERNAL_SERVER_ERROR) {
            this.snackBar.open(ErrorMessage.UnexpectedError, '', SNACK_BAR_ERROR_CONFIGURATION);
        }

        return throwError(() => error);
    };
}
