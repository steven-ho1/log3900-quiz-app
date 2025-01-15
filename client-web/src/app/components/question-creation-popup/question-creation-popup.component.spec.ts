import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder, FormControl, FormGroup, FormGroupName, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Choice, Question, QuestionType } from '@common/game';
import { QuestionCreationPopupComponent } from './question-creation-popup.component';

const DEFAULT_POINTS = 10;
describe('QuestionCreationPopupComponent', () => {
    let component: QuestionCreationPopupComponent;
    let fixture: ComponentFixture<QuestionCreationPopupComponent>;
    let matDialogRefSpy: jasmine.SpyObj<MatDialogRef<QuestionCreationPopupComponent>>;
    let fb: FormBuilder;

    beforeEach(() => {
        matDialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

        TestBed.configureTestingModule({
            declarations: [QuestionCreationPopupComponent, FormGroupName],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: {} },
                { provide: MatDialogRef, useValue: matDialogRefSpy },
            ],
            imports: [FormsModule, HttpClientModule, ReactiveFormsModule, MatSlideToggleModule, MatInputModule, BrowserAnimationsModule],
        });
        fixture = TestBed.createComponent(QuestionCreationPopupComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        fb = TestBed.inject(FormBuilder);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('ngOnInit should call the correct method', () => {
        const mockCreate = spyOn(component, 'createNewForm');
        const mockLoad = spyOn(component, 'loadForm');
        const questionFormGroup: FormGroup = fb.group({
            text: 'Test',
            points: 10,
            type: QuestionType.QCM,
            choices: fb.array([{ answer: '123', isCorrect: true }]),
        });
        component.data = {
            index: 0,
            questionsFormArray: fb.array([questionFormGroup]),
        };

        component.ngOnInit();
        expect(mockLoad).toHaveBeenCalled();

        component.data.index = undefined;
        component.ngOnInit();
        expect(mockCreate).toHaveBeenCalled();
    });

    it('loadForm should correctly set the question form', () => {
        const questionFormGroup: FormGroup = fb.group({
            text: 'Test',
            points: 10,
            type: QuestionType.QCM,
            choices: fb.array([{ answer: '123', isCorrect: true }]),
        });
        component.data = {
            index: 0,
            questionsFormArray: fb.array([questionFormGroup]),
        };

        component.loadForm(fb, 0);

        expect(component.questionForm.get('text')?.value).toBe('Test');
        expect(component.questionForm.get('points')?.value).toBe(DEFAULT_POINTS);
        expect(component.questionForm.get('type')?.value).toBe(QuestionType.QCM);
        expect(component.questionForm.get('choices')?.value).toEqual(questionFormGroup.value.choices);
    });

    it('loadForm should call toggleQuestionType if question type is not QCM', () => {
        const questionFormGroup: FormGroup = fb.group({
            text: 'Test',
            points: 10,
            type: QuestionType.QRL,
            choices: fb.array([{ answer: '123', isCorrect: true }]),
        });
        component.data = {
            index: 0,
            questionsFormArray: fb.array([questionFormGroup]),
        };
        spyOn(component, 'toggleQuestionType');

        component.loadForm(fb, 0);

        expect(component.toggleQuestionType).toHaveBeenCalled();
    });

    it('isQcm should return true if the question type is QCM', () => {
        component.questionType = QuestionType.QCM;
        expect(component.isQcm()).toBeTrue();
        component.questionType = QuestionType.QRL;
        expect(component.isQcm()).toBeFalse();
    });

    it('createNewForm should correctly set the question form', () => {
        component.data = {
            questionsFormArray: fb.array([]) as FormArray,
        };
        component.createNewForm(fb);
        expect(component.questionForm.get('text')?.value).toBe('');
        expect(component.questionForm.get('points')?.value).toBe(DEFAULT_POINTS);
        expect(component.questionForm.get('type')?.value).toBe(QuestionType.QCM);
        expect(component.questionForm.get('choices')?.value).toEqual([
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
        ]);
    });

    it('toggleQuestionType should patch the type control of questionForm member', () => {
        component.questionType = QuestionType.QCM;
        component.questionForm = fb.group({ type: QuestionType.QCM, choices: fb.array([]) });

        component.toggleQuestionType();
        expect(component.questionForm.value.type).toEqual(QuestionType.QRL);

        component.toggleQuestionType();
        expect(component.questionForm.value.type).toEqual(QuestionType.QCM);
    });

    it('toggleQuestionType should disable choices if the new question type is QRL', () => {
        component.questionType = QuestionType.QCM;
        component.questionForm = fb.group({ type: QuestionType.QCM, choices: fb.array([]) });
        spyOn(component.choices, 'disable');
        component.choiceDuplicate = true;

        component.toggleQuestionType();
        expect(component.choices.disable).toHaveBeenCalled();
        expect(component.choiceDuplicate).toBeFalse();
    });

    it('toggleQuestionType should enable choices and check for duplication if the new question type is QCM', () => {
        component.questionType = QuestionType.QRL;
        component.questionForm = fb.group({ type: QuestionType.QRL, choices: fb.array([]) });
        spyOn(component.choices, 'enable');
        spyOn(component, 'verifyChoice');

        component.toggleQuestionType();
        expect(component.choices.enable).toHaveBeenCalled();
        expect(component.verifyChoice).toHaveBeenCalled();
    });

    it('setAnswerStyle should return the correct style depending if it is correct or not', () => {
        const correctRes = { background: '#98FF7F' };
        const incorrectRes = { background: '#FF967F' };

        expect(component.setAnswerStyle(true)).toEqual(correctRes);
        expect(component.setAnswerStyle(false)).toEqual(incorrectRes);
    });

    it('should reorder choices when dropped', () => {
        const initialChoices: Choice[] = [
            { text: 'Choice 1', isCorrect: false },
            { text: 'Choice 2', isCorrect: true },
            { text: 'Choice 3', isCorrect: false },
        ];
        const formArray = new FormArray(
            initialChoices.map(
                (choice) =>
                    new FormGroup({
                        answer: new FormControl(choice.text),
                        isCorrect: new FormControl(choice.isCorrect),
                    }),
            ),
        );

        spyOnProperty(component, 'choices', 'get').and.returnValue(formArray);

        const mockContainer: Partial<CdkDropList<Question[]>> = {
            data: [],
        };
        const mockDragItem = jasmine.createSpyObj('CdkDrag', ['someMethod1', 'someMethod2']);
        const event: CdkDragDrop<Question[]> = {
            previousIndex: 1,
            currentIndex: 2,
            container: mockContainer as CdkDropList<Question[]>,
            previousContainer: mockContainer as CdkDropList<Question[]>,
            isPointerOverContainer: true,
            item: mockDragItem,
            distance: { x: 0, y: 0 },
            dropPoint: { x: 0, y: 0 },
            event: new MouseEvent('drop'),
        };

        const temp = formArray.at(event.previousIndex);
        formArray.removeAt(event.previousIndex);
        formArray.insert(event.currentIndex, temp);
        component.drop(event);

        const finalChoices = component.choices.value;
        expect(finalChoices[0].answer).toEqual('Choice 1');
        expect(finalChoices[1].answer).toEqual('Choice 3');
        expect(finalChoices[2].answer).toEqual('Choice 2');
    });

    it('addChoice should add a choice to the list', () => {
        let nbChoices = component.choices.length;

        component.addChoice(true);
        expect(component.choices.length).toEqual(++nbChoices);
        expect(component.choices.at(nbChoices - 1).value.isCorrect).toBeTrue();

        component.addChoice(false);
        expect(component.choices.length).toEqual(++nbChoices);
        expect(component.choices.at(nbChoices - 1).value.isCorrect).toBeFalse();
    });

    it('addChoice should disable the new choice if choices are disabled', () => {
        component.choices.disable();
        component.addChoice(true);
        expect(component.choices.controls[0].disabled).toBeTrue();
    });

    it('verifyChoice should change choiceDuplicate if the choice already exist', () => {
        component.verifyChoice();
        expect(component.choiceDuplicate).toBeTrue();

        component.choices.value[0].text = 'test1';
        component.choices.value[1].text = 'test2';

        component.verifyChoice();
        expect(component.choiceDuplicate).toBeFalse();
    });

    it('deleteChoice should remove a choice from the list', () => {
        let nbChoices = component.choices.length;

        component.deleteChoice(--nbChoices);
        expect(component.choices.length).toEqual(nbChoices);
    });

    it('closeQuestionCreator should call close from the mat Dialog Ref', () => {
        component.closeQuestionCreator();
        expect(matDialogRefSpy.close).toHaveBeenCalled();
    });

    it('should close the dialog with the questionForm on onSubmit ', () => {
        component.onSubmit();
        expect(matDialogRefSpy.close).toHaveBeenCalledWith(component.questionForm);
    });

    it('canAddAnswer should return false if the answer count has reached its limit', () => {
        expect(component.canAddAnswer()).toBeTrue();

        component.addChoice(true);
        component.addChoice(true);

        expect(component.canAddAnswer()).toBeFalse();
    });

    it('canDeleteAnswer should return false if the answer count is 2', () => {
        expect(component.canDeleteAnswer()).toBeFalse();

        component.addChoice(true);

        expect(component.canDeleteAnswer()).toBeTrue();
    });

    it('isQuestionEmpty should return true if the text of the question is empty and the field is touched', () => {
        component.questionForm.controls['text'].setValue('   ');
        expect(component.isQuestionEmpty()).toBeFalse();

        component.questionForm.controls['text'].markAsDirty();
        expect(component.isQuestionEmpty()).toBeTrue();

        component.questionForm.controls['text'].setValue('a');
        expect(component.isQuestionEmpty()).not.toBeTrue();
    });

    it('showPointsError should return different messages depending on the points of the question', () => {
        const points1 = 5;
        const points2 = 120;
        const msg1 = 'Doit être entre 10 et 100.';
        const points3 = 23;
        const msg2 = 'Doit être un multiple de 10.';

        component.questionForm.controls['points'].setValue(points1);
        expect(component.showPointsError()).toEqual(msg1);

        component.questionForm.controls['points'].setValue(points2);
        expect(component.showPointsError()).toEqual(msg1);

        component.questionForm.controls['points'].setValue(points3);
        expect(component.showPointsError()).toEqual(msg2);
    });

    it('hasMinimumGooodChoices should return true if the number of good answers is between 1 and 3', () => {
        expect(component.hasMinimumGoodChoices()).toBeTrue();

        component.deleteChoice(0);
        expect(component.hasMinimumGoodChoices()).toBeFalse();
    });

    it('hasMinimumGooodChoices should return true if choices are disabled', () => {
        component.choices.disable();
        expect(component.hasMinimumGoodChoices()).toBeTrue();
    });

    it('showCorrectnessError should return the correct message depending of the number of good choices', () => {
        const msg1 = 'Il manque un bon choix.';
        const msg2 = 'Il manque un mauvais choix.';

        component.deleteChoice(1);
        component.deleteChoice(0);
        component.addChoice(false);
        component.addChoice(false);
        component.nGoodChoices = component.choices.value.reduce((counter: number, choice: Choice) => (choice.isCorrect ? counter + 1 : counter), 0);
        expect(component.showCorrectnessError()).toEqual(msg1);

        component.deleteChoice(1);
        component.deleteChoice(0);
        component.addChoice(true);
        component.addChoice(true);
        component.nGoodChoices = component.choices.value.reduce((counter: number, choice: Choice) => (choice.isCorrect ? counter + 1 : counter), 0);
        expect(component.showCorrectnessError()).toEqual(msg2);
    });
});
