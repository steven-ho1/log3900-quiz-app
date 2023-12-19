import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { QRL_DURATION } from '@app/constants/in-game';
import { Game, GameInfo, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { Observable, of } from 'rxjs';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root',
})
export class GameHandlingService {
    // Service qui s'occupe des jeux questionnaires
    currentGame: Game;
    gameMode: GameMode = GameMode.RealGame;
    currentQuestionId: number = 0;
    scoreSource = new BehaviorSubject<number>(0);
    score$ = this.scoreSource.asObservable();
    currentQuestionSource = new BehaviorSubject<string>('');
    currentQuestion$ = this.currentQuestionSource.asObservable();
    private allHistogramData: { [questionId: number]: { [key: string]: number } } = {};
    private readonly baseUrl: string = environment.serverGamesUrl;

    constructor(private http: HttpClient) {}

    getGames(): Observable<Game[]> {
        return this.http.get<Game[]>(this.baseUrl).pipe(catchError(this.handleError<Game[]>('getGames')));
    }

    modifyGame(game: Game): Observable<Game[]> {
        return this.http.patch<Game[]>(`${this.baseUrl}/${game.id}`, game).pipe(catchError(this.handleError<Game[]>('modifyGame')));
    }

    addGame(newGame: Game): Observable<Game[]> {
        return this.http.post<Game[]>(this.baseUrl, newGame).pipe(catchError(this.handleError<Game[]>('addGame')));
    }

    changeVisibility(game: Game): Observable<Game[]> {
        return this.http
            .patch<Game[]>(`${this.baseUrl}/visibility/${game.id}`, { isVisible: game.isVisible })
            .pipe(catchError(this.handleError<Game[]>('changeVisibility')));
    }

    export(id: string) {
        return this.http.get<Game>(`${this.baseUrl}/${id}`, { responseType: 'json' });
    }

    deleteGame(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(this.handleError<void>('deleteGame')));
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
        return this.http.get<GameInfo[]>(`${environment.serverBaseUrl}/api/history`);
    }

    resetHistory(): Observable<GameInfo[]> {
        return this.http.delete<GameInfo[]>(`${environment.serverBaseUrl}/api/history`);
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

    isCurrentQuestionQcm() {
        return this.currentGame.questions[this.currentQuestionId].type === QuestionType.QCM;
    }

    private handleError<T>(request: string, result?: T): (error: { error: Error }) => Observable<T> {
        return (error) => {
            window.alert(error.error.message);
            return of(result as T);
        };
    }
}
