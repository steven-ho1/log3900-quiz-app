import { formatDate } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game, QuestionType } from '@common/game';
import { of } from 'rxjs';
import { FormManagerService } from './form-manager.service';

describe('FormManagerService', () => {
    let service: FormManagerService;
    let fb: FormBuilder;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [GameHandlingService, Router],
        });
        service = TestBed.inject(FormManagerService);
        fb = TestBed.inject(FormBuilder);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('resetGameForm should reset the values of the game Form', () => {
        const form = fb.group({
            id: 0,
            title: ['', Validators.required],
            description: ['', Validators.required],
            duration: 30,
            lastModification: formatDate(new Date(), 'yyyy-MM-dd   h:mm:ss a', 'en'),
            isVisible: false,
            questions: fb.array([]),
        });

        service.resetGameForm();
        expect(service.gameForm.value).toEqual(form.value);
    });

    it('modifyGame should modify the date, call the method from the gameHandler, reset the form and navigate', () => {
        const games: Game[] = [];
        const mockModif = spyOn(TestBed.inject(GameHandlingService), 'modifyGame').and.returnValue(of(games));
        const mockReset = spyOn(service, 'resetGameForm');
        const mockNavigate = spyOn(TestBed.inject(Router), 'navigate');

        service.modifyGame();

        expect(service.gameForm.value.lastModification).toEqual(formatDate(new Date(), 'yyyy-MM-dd   h:mm:ss a', 'en'));
        expect(mockModif).toHaveBeenCalled();
        expect(mockReset).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalled();
    });

    it('addGame should modify the date, call the method from the gameHandler, reset the form and navigate', () => {
        const games: Game[] = [];
        const mockAdd = spyOn(TestBed.inject(GameHandlingService), 'addGame').and.returnValue(of(games));
        const mockReset = spyOn(service, 'resetGameForm');
        const mockNavigate = spyOn(TestBed.inject(Router), 'navigate');

        service.addGame();

        expect(mockAdd).toHaveBeenCalled();
        expect(mockReset).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalled();
    });

    it('sendGameForm should call the correct method', () => {
        const mockGameAdder = spyOn(service, 'addGame');
        const mockModify = spyOn(service, 'modifyGame');

        service.sendGameForm();
        expect(mockGameAdder).toHaveBeenCalled();
        expect(mockModify).not.toHaveBeenCalled();

        mockGameAdder.calls.reset();
        service.nameModif = 'test';
        service.sendGameForm();
        expect(mockModify).toHaveBeenCalled();
        expect(mockGameAdder).not.toHaveBeenCalled();
    });

    it('sendGameForm with importedGameForm parameter should return an Observable', () => {
        const games: Game[] = [];
        const importedGameForm = fb.group({
            title: ['', Validators.required],
            description: ['', Validators.required],
            duration: 30,
            lastModification: formatDate(new Date(), 'yyyy-MM-dd', 'en'),
            isVisible: false,
            questions: fb.array([]),
        });

        const mockGameAdder = spyOn(TestBed.inject(GameHandlingService), 'addGame').and.returnValue(of(games));

        service.sendGameForm(importedGameForm);
        expect(mockGameAdder).toHaveBeenCalled();
    });

    it('createBaseForm should return an empty form', () => {
        const form = service['createBaseForm']();
        expect(form).toBeTruthy();

        expect(form.get('title')).toBeTruthy();
        expect(form.get('description')).toBeTruthy();
        expect(form.get('duration')).toBeTruthy();
        expect(form.get('lastModification')).toBeTruthy();
        expect(form.get('isVisible')).toBeTruthy();
        expect(form.get('questions')).toBeTruthy();
    });

    it('hasQuestions should return true if the number of questions is superior to 0', () => {
        expect(service.hasQuestions()).toBeFalse();
        service.questions.controls[0] = fb.control({});
        expect(service.hasQuestions()).toBeTrue();
    });

    it('initializeImportForm should return a FormGroup used for game importation', () => {
        const gameMock: Game = {
            id: '0',
            title: ' title ',
            description: '  description ',
            duration: 0,
            lastModification: '',
            questions: [
                {
                    text: '  text   ',
                    points: 0,
                    type: QuestionType.QCM,
                    choices: [{ text: ' answer  ', isCorrect: true }],
                },
            ],
        };
        const formMock = fb.group({
            id: gameMock.id,
            title: gameMock.title,
            description: gameMock.description,
            duration: gameMock.duration,
            lastModification: formatDate(new Date(), 'yyyy-MM-dd   h:mm:ss a', 'en'),
            isVisible: false,
            questions: fb.array(gameMock.questions),
        });
        expect(service.initializeImportForm(gameMock).value).toEqual(formMock.value);
    });

    it('preventEmptyInput should return true if the string consist of only white spaces ', () => {
        const controlTest: FormControl = new FormControl();

        controlTest.setValue('  ');
        expect(service.preventEmptyInput(controlTest)?.isEmpty).toBeTrue();

        controlTest.setValue(' s  ');
        expect(service.preventEmptyInput(controlTest)?.isEmpty).not.toBeDefined();
    });

    it('saveQuestions should update the questions FormArray', () => {
        const questionsFormArray = TestBed.inject(FormBuilder).array([{}]);
        const clearSpy = spyOn(service.questions, 'clear');
        const pushSpy = spyOn(service.questions, 'push');

        service.saveQuestions(questionsFormArray);

        expect(clearSpy).toHaveBeenCalled();
        expect(pushSpy).toHaveBeenCalledTimes(questionsFormArray.length);
    });
});
