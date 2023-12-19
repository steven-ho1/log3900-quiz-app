import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Choice, Question, QuestionType } from '@common/game';
import { Limit } from '@common/limit';
import * as lodash from 'lodash-es';

@Component({
    selector: 'app-question-creation-popup',
    templateUrl: './question-creation-popup.component.html',
    styleUrls: ['./question-creation-popup.component.scss'],
})
export class QuestionCreationPopupComponent implements OnInit {
    questionType: QuestionType = QuestionType.QCM;
    nGoodChoices: number = 0;
    maxQuestionLength: number = Limit.MaxQuestionLength;
    maxAnswerLength: number = Limit.MaxQcmAnswerLength;
    choiceDuplicate = false;
    questionForm: FormGroup;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { questionsFormArray: FormArray; index?: number },
        public dialogRef: MatDialogRef<QuestionCreationPopupComponent>,
        private formManager: FormManagerService,
    ) {}

    get choices(): FormArray {
        return this.questionForm.get('choices') as FormArray;
    }

    ngOnInit() {
        const fb: FormBuilder = new FormBuilder();
        if (this.data.index === undefined) this.createNewForm(fb);
        else this.loadForm(fb, this.data.index);
    }

    loadForm(fb: FormBuilder, index: number): void {
        const questionToModify: AbstractControl = this.data.questionsFormArray.controls[index];
        const choicesToModify: FormArray = lodash.cloneDeep(questionToModify.get('choices')) as FormArray;

        this.createNewForm(fb);
        this.questionForm.patchValue({
            text: questionToModify.value.text,
            points: questionToModify.value.points,
            type: questionToModify.value.type,
        });

        if (this.questionForm.value.type === QuestionType.QCM) this.questionForm.setControl('choices', choicesToModify);
        else this.toggleQuestionType();
    }

    isQcm() {
        if (this.questionType === QuestionType.QCM) return true;
        return false;
    }

    createNewForm(fb: FormBuilder): void {
        this.questionForm = fb.group({
            // Source: https://stackoverflow.com/questions/18476318/regex-for-multiples-of-10
            text: ['', [Validators.required, this.formManager.preventEmptyInput]],
            points: [Limit.MinPoints, [Validators.required, Validators.pattern('^[1-9][0-9]*0$'), Validators.max(Limit.MaxPoints)]],
            type: QuestionType.QCM,
            choices: fb.array([]),
        });
        this.addChoice(true);
        this.addChoice(false);
    }

    toggleQuestionType() {
        this.questionType = this.questionType === QuestionType.QCM ? QuestionType.QRL : QuestionType.QCM;
        this.questionForm.patchValue({ type: this.questionType });

        if (this.questionType === QuestionType.QRL) {
            this.choices.disable();
            this.choiceDuplicate = false;
            return;
        }
        this.choices.enable();
        this.verifyChoice();
    }

    setAnswerStyle(isCorrect: boolean): { background: string } {
        return isCorrect ? { background: '#98FF7F' } : { background: '#FF967F' };
    }

    drop(event: CdkDragDrop<Question[]>): void {
        // Gestion du deplacement par drag and drop
        moveItemInArray(this.choices.controls, event.previousIndex, event.currentIndex);
    }

    addChoice(isChoiceCorrect: boolean) {
        const fb: FormBuilder = new FormBuilder();
        const newChoice = fb.group({
            text: ['', [Validators.required, this.formManager.preventEmptyInput]],
            isCorrect: isChoiceCorrect,
        });
        if (this.choices.disabled) newChoice.disable();

        this.choices.push(newChoice);
    }

    verifyChoice(): void {
        for (let i = 0; i < this.choices.length; i++) {
            for (let j = i + 1; j < this.choices.length; j++) {
                if (this.choices.value[i].text.trim().toLowerCase() === this.choices.value[j].text.trim().toLowerCase()) {
                    this.choiceDuplicate = true;
                    return;
                }
            }
        }
        this.choiceDuplicate = false;
    }

    deleteChoice(index: number) {
        this.choices.removeAt(index);
    }

    closeQuestionCreator() {
        this.dialogRef.close();
    }

    onSubmit() {
        this.dialogRef.close(this.questionForm);
    }

    canAddAnswer(): boolean {
        return this.choices.length !== Limit.MaxChoicesNumber;
    }

    canDeleteAnswer(): boolean {
        return this.choices.length !== Limit.MinChoicesNumber;
    }

    isQuestionEmpty(): boolean {
        return this.questionForm.controls['text'].dirty && this.questionForm.controls['text'].hasError('isEmpty');
    }

    showPointsError(): string {
        const points: number = this.questionForm.controls['points'].value;
        return points < Limit.MinPoints || points > Limit.MaxPoints ? 'Doit être entre 10 et 100.' : 'Doit être un multiple de 10.';
    }

    hasMinimumGoodChoices(): boolean {
        if (this.choices.disabled) return true;
        this.nGoodChoices = this.choices.value.reduce((counter: number, choice: Choice) => (choice.isCorrect ? counter + 1 : counter), 0);
        return Limit.MinGoodChoices <= this.nGoodChoices && this.nGoodChoices < this.choices.length;
    }

    showCorrectnessError(): string {
        return this.nGoodChoices < Limit.MinGoodChoices ? 'Il manque un bon choix.' : 'Il manque un mauvais choix.';
    }
}
