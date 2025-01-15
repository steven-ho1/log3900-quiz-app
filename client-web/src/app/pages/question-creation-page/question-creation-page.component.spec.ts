import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule, convertToParamMap } from '@angular/router';
import { HeaderComponent } from '@app/components/header/header.component';
import { QuestionCreationPopupComponent } from '@app/components/question-creation-popup/question-creation-popup.component';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Question, QuestionType } from '@common/game';
import { Observable, of } from 'rxjs';
import { QCM_COLOR, QRL_COLOR, QuestionCreationPageComponent } from './question-creation-page.component';

describe('QuestionCreationPageComponent', () => {
    let component: QuestionCreationPageComponent;
    let fixture: ComponentFixture<QuestionCreationPageComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [QuestionCreationPageComponent, HeaderComponent],
            imports: [MatDialogModule, HttpClientTestingModule, MatIconModule, RouterModule, MatSnackBarModule],
            providers: [
                FormManagerService,
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
        });
        fixture = TestBed.createComponent(QuestionCreationPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('setQuestionStyle should return the good color depending of the type of question', () => {
        const qcmColor = { background: QCM_COLOR };
        const qrlColor = { background: QRL_COLOR };
        const question: Question = {
            text: '',
            points: 0,
            type: QuestionType.QCM,
            choices: [],
        };

        expect(component.setQuestionStyle(question)).toEqual(qcmColor);

        question.type = QuestionType.QRL;
        expect(component.setQuestionStyle(question)).toEqual(qrlColor);
    });

    it('openQuestionCreator should open the question creator dialog', () => {
        component.questionsFormArray = TestBed.inject(FormBuilder).array([]);
        let formArrayLength = component.questionsFormArray.length;

        const observableMock: Observable<FormGroup> = new Observable((subscriber) => subscriber.next(new FormGroup({})));
        const dialogSpy = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({
            afterClosed: () => observableMock,
        } as MatDialogRef<QuestionCreationPopupComponent>);

        component.openQuestionCreator();
        expect(dialogSpy).toHaveBeenCalled();
        expect(component.questionsFormArray.length).toEqual(++formArrayLength);

        const index = 0;
        component.openQuestionCreator(index);
        expect(component.questionsFormArray.length).toEqual(formArrayLength);
    });

    it('deleteQuestion should remove one item from the array', () => {
        component.questionsFormArray = TestBed.inject(FormBuilder).array([{}]);

        component.deleteQuestion(0);
        expect(component.questionsFormArray.length).toEqual(0);
    });

    it('saveQuestions should call formManagerService', () => {
        const formManagerSpy = spyOn(TestBed.inject(FormManagerService), 'saveQuestions');
        component.saveQuestions();
        expect(formManagerSpy).toHaveBeenCalled();
    });

    it('isEmpty should return true if the question list is empty', () => {
        expect(component.isEmpty()).toBeTrue();
        const question: FormGroup = new FormGroup(0);
        component.questionsFormArray.push(question);
        expect(component.isEmpty()).toBeFalse();
    });

    it('drop should change the order of the questions in the array', () => {
        const question1: Question = {
            text: 'Question 1',
            points: 0,
            type: QuestionType.QCM,
            choices: [],
        };
        const question2: Question = {
            text: 'Question 2',
            points: 0,
            type: QuestionType.QCM,
            choices: [],
        };
        component.questionsFormArray = TestBed.inject(FormBuilder).array([question1, question2]);

        const event = {
            previousIndex: 0,
            currentIndex: 1,
            item: {},
            container: {},
            isPointerOverContainer: true,
            distance: { x: 0, y: 0 },
        } as CdkDragDrop<Question[]>;

        component.drop(event);

        expect(component.questionsFormArray.at(0).value).toEqual(question2);
        expect(component.questionsFormArray.at(1).value).toEqual(question1);
    });
});
