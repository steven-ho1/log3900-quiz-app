import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ImportStates } from '@app/constants/enums';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Game, QuestionType } from '@common/game';
import { Observable } from 'rxjs';
import { GameImportPopupComponent } from './game-import-popup.component';

describe('GameImportPopupComponent', () => {
    let component: GameImportPopupComponent;
    let fixture: ComponentFixture<GameImportPopupComponent>;

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
                choices: [{ text: ' text  ', isCorrect: true }],
            },
        ],
    };

    const dataMock: { importedGame: Game; games: Game[] } = {
        importedGame: gameMock,
        games: [gameMock, gameMock],
    };

    const dialogRefSpy = { close: jasmine.createSpy('dialog') };

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [GameImportPopupComponent],
            imports: [HttpClientTestingModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, BrowserAnimationsModule],
            providers: [{ provide: MAT_DIALOG_DATA, useValue: dataMock }, { provide: MatDialogRef, useValue: dialogRefSpy }, FormBuilder],
        });
        fixture = TestBed.createComponent(GameImportPopupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('ngOnInit should initialize games', () => {
        expect(component.games).toEqual(dataMock.games);
    });

    it('getImportState should initialize importState', () => {
        const titleExistenceSpy = spyOn(component, 'titleAlreadyExists').and.returnValue(true);

        component.getImportState();
        expect(component.importState).toEqual(ImportStates.NameExists);
        expect(titleExistenceSpy).toHaveBeenCalled();

        titleExistenceSpy.and.returnValue(false);
        component.getImportState();
        expect(component.importState).toEqual(ImportStates.ValidForm);

        const fb = new FormBuilder();
        const formGroup = fb.group({ title: undefined });

        spyOn(TestBed.inject(FormManagerService), 'initializeImportForm').and.returnValue(formGroup);
        const mockAlert = spyOn(window, 'alert');
        expect(component.getImportState()).toBeUndefined();
        expect(mockAlert).toHaveBeenCalled();
    });

    it('closeDialog should reset the form and close the dialog', () => {
        const formManagerSpy = spyOn(TestBed.inject(FormManagerService), 'resetGameForm');

        component.closeDialog();
        expect(formManagerSpy).toHaveBeenCalled();
        expect(dialogRefSpy.close).toHaveBeenCalled();
    });

    it('titleAlreadyExists should return true if a game title is already used', () => {
        component.games[0] = {
            id: '0',
            title: 'Game 1',
            description: '',
            duration: 0,
            lastModification: '',
            isVisible: false,
            questions: [],
        };

        component.gameForm = TestBed.inject(FormBuilder).group({
            title: 'Game 1',
        });

        expect(component.titleAlreadyExists()).toBeTrue();
        component.gameForm.patchValue({ title: 'Game 2' });
        expect(component.titleAlreadyExists()).toBeFalse();
    });

    it('isNewTitleEmpty should return true if the entered title is empty', () => {
        component.gameForm = TestBed.inject(FormBuilder).group({
            title: '',
        });

        expect(component.isNewTitleEmpty()).toBeTrue();
        component.gameForm.patchValue({ title: 'Game 2' });
        expect(component.isNewTitleEmpty()).toBeFalse();
    });

    it('onSubmit should submit the gameForm and close the dialog', () => {
        const gameObservable: Observable<Game[]> = new Observable((subscriber) => subscriber.next([]));
        const formManagerMock = spyOn(TestBed.inject(FormManagerService), 'sendGameForm').and.returnValue(gameObservable);

        component.onSubmit();
        expect(formManagerMock).toHaveBeenCalled();

        expect(dialogRefSpy.close).toHaveBeenCalledWith([]);
    });
});
