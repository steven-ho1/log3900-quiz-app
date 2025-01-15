import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ProgressBarComponent } from '@app/components/progress-bar/progress-bar.component';
import { ClientSocketService } from '@app/services/client-socket/client-socket.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { TimerService } from '@app/services/timer/timer.service';
import { GameMode } from '@common/game-mode';

describe('ProgressBarComponent', () => {
    const currentQuestionDuration = 10;

    let component: ProgressBarComponent;
    let fixture: ComponentFixture<ProgressBarComponent>;
    let gameHandlingServiceMock: jasmine.SpyObj<GameHandlingService>;
    let timeServiceMock: jasmine.SpyObj<TimerService>;
    let clientSocketServiceMock: jasmine.SpyObj<ClientSocketService>;

    beforeEach(() => {
        timeServiceMock = jasmine.createSpyObj('TimeService', ['startCountdown']);
        gameHandlingServiceMock = jasmine.createSpyObj('GameHandlingService', ['getCurrentQuestionDuration']);
        clientSocketServiceMock = jasmine.createSpyObj('ClientSocketService', ['']);

        TestBed.configureTestingModule({
            declarations: [ProgressBarComponent],
            imports: [MatSnackBarModule],
            providers: [
                { provide: GameHandlingService, useValue: gameHandlingServiceMock },
                { provide: TimerService, useValue: timeServiceMock },
                { provide: ClientSocketService, useValue: clientSocketServiceMock },
            ],
        });

        fixture = TestBed.createComponent(ProgressBarComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('count getter should return count from TimerService', () => {
        const currentCount = 0;
        timeServiceMock.count = currentCount;
        expect(component.count).toEqual(currentCount);
    });

    it('isPanicModeEnabled getter should return isPanicModeEnabled from TimerService', () => {
        timeServiceMock.isPanicModeEnabled = true;
        expect(component.isPanicModeEnabled).toEqual(true);

        timeServiceMock.isPanicModeEnabled = false;
        expect(component.isPanicModeEnabled).toEqual(false);
    });

    it('isCountdownRunning getter should return isCountdownRunning from TimerService', () => {
        timeServiceMock.isCountdownRunning = true;
        expect(component.isCountdownRunning).toEqual(true);

        timeServiceMock.isCountdownRunning = false;
        expect(component.isCountdownRunning).toEqual(false);
    });

    it('currentQuestionDuration getter should return value from calling getCurrentQuestionDuration from GameHandlingService', () => {
        gameHandlingServiceMock.getCurrentQuestionDuration.and.returnValue(currentQuestionDuration);
        expect(component.currentQuestionDuration).toEqual(currentQuestionDuration);
    });

    it('should start countDown on component initialization if the player is the organizer', () => {
        clientSocketServiceMock.isOrganizer = true;
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        spyOnProperty(component, 'currentQuestionDuration', 'get').and.returnValue(currentQuestionDuration);
        component.ngOnInit();
        expect(timeServiceMock.startCountdown).toHaveBeenCalledWith(currentQuestionDuration);
    });

    it('should start countDown on component initialization if the player is a tester', () => {
        gameHandlingServiceMock.gameMode = GameMode.Testing;
        clientSocketServiceMock.isOrganizer = false;
        spyOnProperty(component, 'currentQuestionDuration', 'get').and.returnValue(currentQuestionDuration);
        component.ngOnInit();
        expect(timeServiceMock.startCountdown).toHaveBeenCalledWith(currentQuestionDuration);
    });

    it('should not start countDown on component initialization if the player is not the organizer or a tester', () => {
        gameHandlingServiceMock.gameMode = GameMode.RealGame;
        clientSocketServiceMock.isOrganizer = false;
        component.ngOnInit();
        expect(timeServiceMock.startCountdown).not.toHaveBeenCalled();
    });
});
