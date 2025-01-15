import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule, convertToParamMap } from '@angular/router';
import { HeaderComponent } from '@app/components/header/header.component';
import { Route } from '@app/constants/enums';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game } from '@common/game';
import { of } from 'rxjs';
import { QuizCreationPageComponent } from './quiz-creation-page.component';

describe('QuizCreationPageComponent', () => {
    let component: QuizCreationPageComponent;
    let fixture: ComponentFixture<QuizCreationPageComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [QuizCreationPageComponent, HeaderComponent],
            providers: [
                GameHandlingService,
                FormManagerService,
                Router,
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
            imports: [HttpClientTestingModule, ReactiveFormsModule, MatIconModule, RouterModule, MatSnackBarModule],
        }).compileComponents();
        fixture = TestBed.createComponent(QuizCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('ngOnInit should get the list of games', () => {
        const games: Game[] = [];
        const mockGetGames = spyOn(TestBed.inject(GameHandlingService), 'getGames').and.returnValue(of(games));

        component.ngOnInit();
        expect(mockGetGames).toHaveBeenCalled();
        expect(component.games).toBeDefined();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('verifyName should change isNameEmpty if the name is empty', () => {
        const nameInput = fixture.debugElement.nativeElement.querySelector('#nameField');
        const event = new InputEvent('keyup');
        component.games = new Array();
        component.games.push({
            id: '0',
            title: 'Game 1',
            description: '',
            duration: 0,
            lastModification: '',
            isVisible: false,
            questions: [],
        });

        nameInput.value = '';
        nameInput.dispatchEvent(event);

        component.verifyName(event);
        expect(component.isNameEmpty).toBeTrue();

        nameInput.value = ' ';
        component.verifyName(event);
        expect(component.isNameEmpty).toBeTrue();
    });

    it('verifyName should call if the name is different from nameModif', () => {
        const nameInput = fixture.debugElement.nativeElement.querySelector('#nameField');
        const event = new InputEvent('keyup');
        component.games = new Array();

        nameInput.value = 'Game 1';
        nameInput.dispatchEvent(event);
        const mockVerifyDup = spyOn(component, 'verifyNameDuplicate');

        component.verifyName(event);
        expect(component.isNameEmpty).toBeFalse();
        expect(mockVerifyDup).toHaveBeenCalled();

        mockVerifyDup.calls.reset();
        component.nameModif = 'Game 1';
        component.verifyName(event);
        expect(component.isNameEmpty).toBeFalse();
        expect(mockVerifyDup).not.toHaveBeenCalled();

        nameInput.value = 'Game 2';
        component.verifyName(event);
        expect(component.isNameEmpty).toBeFalse();
        expect(mockVerifyDup).toHaveBeenCalled();
    });

    it('verifyNameDuplicate should change isNameDuplicate if the name is already existing', () => {
        component.games = new Array();
        component.games.push({
            id: '0',
            title: 'Game 1',
            description: '',
            duration: 0,
            lastModification: '',
            isVisible: false,
            questions: [],
        });

        component.verifyNameDuplicate('  Game 1');
        expect(component.isNameDuplicate).toBeTrue();

        component.verifyNameDuplicate('Test');
        expect(component.isNameDuplicate).toBeFalse();
    });

    it('verifyDesc should change isDescEmpty if the description is empty', () => {
        const nameInput = fixture.debugElement.nativeElement.querySelector('#description');
        const event = new InputEvent('keyup');

        nameInput.dispatchEvent(event);
        nameInput.value = '';

        component.verifyDesc(event);
        expect(component.isDescEmpty).toBeTrue();

        nameInput.value = ' ';
        component.verifyDesc(event);
        expect(component.isDescEmpty).toBeTrue();
    });

    it('verifyTimer should change isTimerInvalid if the timer is invalid', () => {
        const nameInput = fixture.debugElement.nativeElement.querySelector('#time_field');
        const event = new InputEvent('change');

        nameInput.dispatchEvent(event);
        nameInput.value = '';

        component.verifyTimer(event);
        expect(component.isTimerInvalid).toBeTrue();

        nameInput.value = ' ';
        component.verifyTimer(event);
        expect(component.isTimerInvalid).toBeTrue();

        nameInput.value = 1;
        component.verifyTimer(event);
        expect(component.isTimerInvalid).toBeTrue();

        nameInput.value = 23;
        component.verifyTimer(event);
        expect(component.isTimerInvalid).toBeFalse();

        nameInput.value = 87;
        component.verifyTimer(event);
        expect(component.isTimerInvalid).toBeTrue();
    });

    it('onSubmit should call sendGameForm from the form Manager', () => {
        const mockSend = spyOn(TestBed.inject(FormManagerService), 'sendGameForm');

        component.onSubmit();

        expect(mockSend).toHaveBeenCalled();
    });

    it('games should be equal to the games from the GameHandlingService', () => {
        const response: Game[] = [];
        spyOn(TestBed.inject(GameHandlingService), 'getGames').and.returnValue(of(response));

        component.ngOnInit();
        fixture.detectChanges();

        expect(component.games).toEqual(response);
    });

    it('hasQuestions should call hasQuestion from the form Manager', () => {
        const mockHasQuestions = spyOn(TestBed.inject(FormManagerService), 'hasQuestions').and.returnValue(true);
        component.hasQuestions();
        expect(mockHasQuestions).toHaveBeenCalled();
    });

    it('accessQuestionCreation should set isAccessingQuestionCreation to true and navigate to question creation page', () => {
        const router: Router = TestBed.inject(Router);
        spyOn(router, 'navigate');
        component.isAccessingQuestionCreation = false;

        component.accessQuestionCreation();
        expect(component.isAccessingQuestionCreation).toBeTrue();
        expect(router.navigate).toHaveBeenCalledWith([Route.QuestionCreation]);
    });
});
