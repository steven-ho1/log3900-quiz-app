import { formatDate } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule, convertToParamMap } from '@angular/router';
import { GameImportPopupComponent } from '@app/components/game-import-popup/game-import-popup.component';
import { HeaderComponent } from '@app/components/header/header.component';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game, QuestionType } from '@common/game';
import { Observable, of } from 'rxjs';
import { AdminJeuPageComponent } from './admin-jeu-page.component';
interface MockEvent {
    target: {
        files: File[];
        value: string;
    };
}
describe('AdminJeuPageComponent', () => {
    let mockRouter: jasmine.SpyObj<Router>;
    let formManagerServiceSpy: jasmine.SpyObj<FormManagerService>;
    let component: AdminJeuPageComponent;
    let fixture: ComponentFixture<AdminJeuPageComponent>;
    let gameHandler: GameHandlingService;

    const mockGames: Game[] = [
        {
            id: '1',
            title: 'Test Game',
            description: 'Test Description',
            duration: 10,
            lastModification: formatDate(new Date(), 'yyyy-MM-dd', 'en'),
            isVisible: true,
            questions: [
                {
                    text: 'Question 1',
                    points: 10,
                    type: QuestionType.QCM,
                    choices: [
                        { text: 'Choice 1', isCorrect: true },
                        { text: 'Choice 2', isCorrect: false },
                    ],
                },
                {
                    text: 'Question 2',
                    points: 10,
                    type: QuestionType.QRL,
                },
            ],
        },
    ];

    beforeEach(async () => {
        mockRouter = jasmine.createSpyObj('Router', ['navigate']);
        formManagerServiceSpy = jasmine.createSpyObj('FormManagerService', ['preventEmptyInput']);

        await TestBed.configureTestingModule({
            imports: [HttpClientTestingModule, MatIconModule, MatDialogModule, RouterModule, MatSnackBarModule],
            declarations: [AdminJeuPageComponent, HeaderComponent],
            providers: [
                GameHandlingService,
                { provide: FormManagerService, useValue: formManagerServiceSpy },
                { provide: Router, useValue: mockRouter },
                FormBuilder,
                {
                    provide: ActivatedRoute,
                    useValue: {
                        queryParams: of(
                            convertToParamMap({
                                search: '',
                            }),
                        ),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(AdminJeuPageComponent);
        component = fixture.componentInstance;
        gameHandler = TestBed.inject(GameHandlingService);

        spyOn(gameHandler, 'getGames').and.returnValue(of(mockGames));
        spyOn(gameHandler, 'export').and.returnValue(of(mockGames[0]));
        spyOn(gameHandler, 'changeVisibility').and.returnValue(of([{ ...mockGames[0], isVisible: false }]));
        spyOn(gameHandler, 'deleteGame').and.returnValue(of(undefined));
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('modifyGame should save the game information in the formManager', () => {
        component.modifyGame(mockGames[0]);
        expect(formManagerServiceSpy.gameForm.value).toEqual(mockGames[0]);
        expect(formManagerServiceSpy.nameModif).toEqual(mockGames[0].title);
    });

    it('should retrieve the list of games on initialization', () => {
        component.ngOnInit();
        expect(gameHandler.getGames).toHaveBeenCalled();
        expect(component.games).toEqual(mockGames);
    });

    it('should export a game', () => {
        component.exportGame('0');
        expect(gameHandler.export).toHaveBeenCalledWith('0');
    });

    it('should toggle the visibility of a game', () => {
        component.games = [...mockGames];
        component.toggleVisibility(mockGames[0]);
        expect(gameHandler.changeVisibility).toHaveBeenCalledWith({ ...mockGames[0], isVisible: false });
        expect(component.games[0].isVisible).toBe(false);
    });

    it('isGameInList should return true if the game is in the list of games', () => {
        component.games = [...mockGames];
        const game = {
            id: '1',
            title: 'Test2',
            description: 'Test Description',
            duration: 10,
            lastModification: '2023-09-30',
            isVisible: true,
            questions: [],
        };
        expect(component.isGameInList(mockGames[0])).toBeTrue();
        expect(component.isGameInList(game)).toBeFalse();
    });

    it('deleteGame should call window.alert if the game is not in the list and confirmDeletion if it is', () => {
        const mockAlert = spyOn(window, 'alert');
        const mockConfirm = spyOn(component, 'confirmDeletion');
        component.games = [...mockGames];
        const game = {
            id: '1',
            title: 'Test2',
            description: 'Test Description',
            duration: 10,
            lastModification: '2023-09-30',
            isVisible: true,
            questions: [],
        };
        component.deleteGame(component.games[0]);
        expect(mockAlert).not.toHaveBeenCalled();
        expect(mockConfirm).toHaveBeenCalled();

        mockConfirm.calls.reset();
        component.deleteGame(game);
        expect(mockAlert).toHaveBeenCalled();
        expect(mockConfirm).not.toHaveBeenCalled();
    });

    it('confirmDeletion should delete a game', () => {
        spyOn(window, 'confirm').and.returnValue(true);
        component.games = [...mockGames];
        const initialLength = component.games.length;
        component.confirmDeletion(component.games[0]);
        expect(gameHandler.deleteGame).toHaveBeenCalledWith(mockGames[0].id);
        expect(component.games.length).toBe(initialLength - 1);
    });

    it('readFile should correctly handle valid JSON content', (done) => {
        const mockFileContent = '{"valid": "json"}';
        const mockFile = new File([mockFileContent], 'mockFile.txt', { type: 'application/json' });
        component.readFile(mockFile as File);

        setTimeout(() => {
            expect(component.isFormInvalid).toBeFalse();
            expect(component.isFileEmpty).toBeFalse();
            done();
        });
    });

    it('should set isFileEmpty for empty files', (done) => {
        const mockTimeOut = 100;
        const mockFile = new File([''], 'empty.txt', { type: 'text/plain' });
        component.readFile(mockFile as File);
        setTimeout(() => {
            expect(component.isFileEmpty).toBeTrue();
            expect(component.isFormInvalid).toBeFalse();
            done();
        }, mockTimeOut);
    });

    it('should set isFormInvalid for invalid JSON content', (done) => {
        const mockTimeOut = 100;
        const mockFile = new File(['Invalid JSON'], 'invalid.json', { type: 'text/plain' });
        component.readFile(mockFile as File);
        setTimeout(() => {
            expect(component.isFormInvalid).toBeTrue();
            expect(component.isFileEmpty).toBeFalse();
            done();
        }, mockTimeOut);
    });

    it('should read the file when provided', () => {
        const mockFileContent = '{"valid": "json"}';
        const mockFile = new File([mockFileContent], 'mockFile.txt', { type: 'application/json' });
        const mockEvent: MockEvent = {
            target: {
                files: [mockFile],
                value: '',
            },
        };
        spyOn(component, 'readFile').and.callThrough();
        component.importGame(mockEvent as unknown as Event);
        expect(component.readFile).toHaveBeenCalledWith(mockEvent.target.files[0]);
    });

    it('openImportPopup should open importDialog', () => {
        const gamesMockObservable: Observable<Game[]> = new Observable((subscriber) => subscriber.next(mockGames));
        const emptyObservable: Observable<void> = new Observable((subscriber) => subscriber.next(undefined));
        const dialogSpy = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({
            afterClosed: () => gamesMockObservable,
        } as MatDialogRef<GameImportPopupComponent>);

        component.openImportPopup(mockGames[0]);
        expect(dialogSpy).toHaveBeenCalled();
        expect(component.games).toEqual(mockGames);

        component.games = [];
        dialogSpy.and.returnValue({
            afterClosed: () => emptyObservable,
        } as MatDialogRef<GameImportPopupComponent>);
        component.openImportPopup(mockGames[0]);
        expect(component.games).toEqual([]);
    });
});
