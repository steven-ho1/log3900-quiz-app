import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, ElementRef, inject, Inject, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErrorMessage } from '@app/constants/error-message';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Choice, Question, QuestionType } from '@common/game';
import { CHAT_IMAGE_MAX_SIZE_BYTES, ORIENTATION, QUALITY, RATIO, VALID_FILE_TYPES } from '@common/item';
import { Limit } from '@common/limit';
import { Language } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import * as lodash from 'lodash-es';
import { NgxImageCompressService } from 'ngx-image-compress';

@Component({
    selector: 'app-question-creation-popup',
    templateUrl: './question-creation-popup.component.html',
    styleUrls: ['./question-creation-popup.component.scss'],
})
export class QuestionCreationPopupComponent implements OnInit {
    @ViewChild('fileUploadInput', { static: false }) fileUploadInput: ElementRef;
    questionType: QuestionType = QuestionType.QCM;
    nGoodChoices: number = 0;
    maxQuestionLength: number = Limit.MaxQuestionLength;
    maxAnswerLength: number = Limit.MaxQcmAnswerLength;
    choiceDuplicate = false;
    questionForm: FormGroup;
    errorMsg: string = '';
    selectedQstImage: string = '';
    protected fileName: string = '';
    protected errorMessage: string = '';
    protected currentLanguage: string;
    private translate: TranslateService = inject(TranslateService);

    // eslint-disable-next-line max-params
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { questionsFormArray: FormArray; index?: number },
        public dialogRef: MatDialogRef<QuestionCreationPopupComponent>,
        private formManager: FormManagerService,
        private imageCompress: NgxImageCompressService,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    get choices(): FormArray {
        return this.questionForm.get('choices') as FormArray;
    }

    get lowerBound(): FormControl {
        return this.questionForm.get('lowerBound') as FormControl;
    }

    get upperBound(): FormControl {
        return this.questionForm.get('upperBound') as FormControl;
    }

    get correctSlideAnswer(): FormControl {
        return this.questionForm.get('correctSlideAnswer') as FormControl;
    }

    get toleranceMargin(): FormControl {
        return this.questionForm.get('toleranceMargin') as FormControl;
    }

    ngOnInit() {
        const fb: FormBuilder = new FormBuilder();
        if (this.data.index === undefined) this.createNewForm(fb);
        else this.loadForm(fb, this.data.index);
        this.lowerBound.valueChanges.subscribe(() => this.validateAnswerBounds());
        this.upperBound.valueChanges.subscribe(() => this.validateAnswerBounds());
        this.correctSlideAnswer.valueChanges.subscribe(() => this.validateAnswerBounds());
    }

    loadForm(fb: FormBuilder, index: number): void {
        const questionToModify: AbstractControl = this.data.questionsFormArray.controls[index];
        const choicesToModify: FormArray = lodash.cloneDeep(questionToModify.get('choices')) as FormArray;
        this.questionType = questionToModify.value.type;
        this.createNewForm(fb);
        this.questionForm.patchValue({
            text: questionToModify.value.text,
            points: questionToModify.value.points,
            type: questionToModify.value.type,
            qstImage: {
                data: questionToModify.value.qstImage.data,
                name: questionToModify.value.qstImage.name,
            },
        });
        if (questionToModify.value.qstImage.name) this.fileName = questionToModify.value.qstImage.name;

        if (this.questionForm.value.type === QuestionType.QCM) {
            this.questionForm.setControl('choices', choicesToModify);
            this.disableQREFormControl();
        } else {
            this.choices.disable();
            if (this.questionForm.value.type === QuestionType.QRE) {
                this.questionForm.patchValue({
                    correctSlideAnswer: questionToModify.value.correctSlideAnswer,
                    lowerBound: questionToModify.value.lowerBound,
                    upperBound: questionToModify.value.upperBound,
                    toleranceMargin: questionToModify.value.toleranceMargin,
                });
            } else {
                this.disableQREFormControl();
            }
        }
    }

    getQuestionType() {
        switch (this.questionType) {
            case QuestionType.QCM:
                return this.currentLanguage === Language.French ? 'QCM' : 'MCQ';
            case QuestionType.QRL:
                return this.currentLanguage === Language.French ? 'QRL' : 'OEQ';

            case QuestionType.QRE:
                return this.currentLanguage === Language.French ? 'QRE' : 'EQ';
        }
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
            correctSlideAnswer: [Limit.LowerBoundMin, Validators.required], // La bonne réponse pour QRE
            lowerBound: [Limit.LowerBoundMin, Validators.required], // Borne inférieure
            upperBound: [Limit.UpperBoundMin, Validators.required], // Borne supérieure
            toleranceMargin: [Limit.LowerBoundMin, Validators.required], // Marge de tolérance
            qstImage: [{ data: null, name: null }],
        });
        this.addChoice(true);
        this.addChoice(false);
    }

    toggleQuestionType() {
        switch (this.questionType) {
            case QuestionType.QCM:
                this.questionType = QuestionType.QRL;
                this.questionForm.patchValue({ type: this.questionType });
                this.choices.disable();
                this.choiceDuplicate = false;
                this.disableQREFormControl();
                break;

            case QuestionType.QRL:
                this.questionType = QuestionType.QRE;
                this.questionForm.patchValue({ type: this.questionType });
                this.enableQREFormControl();
                this.choices.disable();
                this.choiceDuplicate = false;
                break;

            case QuestionType.QRE:
                this.questionType = QuestionType.QCM;
                this.questionForm.patchValue({ type: this.questionType });
                this.disableQREFormControl();
                this.choices.enable();
                this.verifyChoice();
                break;

            default:
                break;
        }
    }

    disableQREFormControl(): void {
        this.upperBound.disable();
        this.lowerBound.disable();
        this.correctSlideAnswer.disable();
        this.toleranceMargin.disable();
    }

    enableQREFormControl(): void {
        this.upperBound.enable();
        this.lowerBound.enable();
        this.correctSlideAnswer.enable();
        this.toleranceMargin.enable();
    }

    validateAnswerBounds(): void {
        const answer = this.correctSlideAnswer.value;
        const lower = this.lowerBound.value;
        const upper = this.upperBound.value;
        const maxTolerance = Math.floor((upper - lower) * Limit.MarginTolerance);
        if (lower >= upper) {
            this.lowerBound.setErrors({ outOfBounds: true });
            this.errorMsg =
                this.currentLanguage === Language.French
                    ? 'La borne inférieure doit être plus petite que la borne supérieure.'
                    : 'The lower bound must be smaller than the upper bound.';
        } else {
            this.lowerBound.setErrors(null);
            this.upperBound.setErrors(null);
        }

        this.toleranceMargin.setValidators([Validators.required, Validators.max(maxTolerance)]);
        this.toleranceMargin.updateValueAndValidity();
        if (answer < lower || answer > upper) {
            if (lower < upper) {
                this.errorMsg =
                    this.currentLanguage === Language.French
                        ? `La bonne réponse doit être comprise entre ${lower} et ${upper} inclus.`
                        : `The correct answer must be between ${lower} and ${upper}, inclusive.`;
            }
            this.correctSlideAnswer.setErrors({ outOfBounds: true });
        } else {
            this.correctSlideAnswer.setErrors(null);
        }
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
        return points < Limit.MinPoints || points > Limit.MaxPoints ? ErrorMessage.PointsRangeError : ErrorMessage.PointsMultipleError;
    }

    hasMinimumGoodChoices(): boolean {
        if (this.choices.disabled) return true;
        this.nGoodChoices = this.choices.value.reduce((counter: number, choice: Choice) => (choice.isCorrect ? counter + 1 : counter), 0);
        return Limit.MinGoodChoices <= this.nGoodChoices && this.nGoodChoices < this.choices.length;
    }

    showCorrectnessError(): string {
        return this.nGoodChoices < Limit.MinGoodChoices ? ErrorMessage.MissingGoodChoiceError : ErrorMessage.MissingBadChoiceError;
    }

    deleteImage(): void {
        this.questionForm.patchValue({
            qstImage: {
                data: null,
                name: null,
            },
        });
        this.fileName = '';
    }

    protected onImageUpload() {
        if (this.fileUploadInput.nativeElement.files && this.fileUploadInput.nativeElement.files.length > 0) {
            const file = this.fileUploadInput.nativeElement.files[0];

            if (!VALID_FILE_TYPES.includes(file.type)) {
                this.errorMessage = this.currentLanguage === Language.French ? 'Format non accepté!' : 'Unsupported format!';
                return;
            }

            if (file.size > CHAT_IMAGE_MAX_SIZE_BYTES) {
                this.errorMessage = this.currentLanguage === Language.French ? 'Fichier volumineux!' : 'File is too large!';
                return;
            }

            this.errorMessage = '';
            const reader = new FileReader();
            /*
                An event handler is assigned to the onload event of the FileReader instance.
                This event is triggered when the file reading operation is successfully completed (after calling readAsDataURL method)
            */
            reader.onload = (e) => {
                const avatarUrl = e.target?.result as string;

                this.imageCompress.compressFile(avatarUrl, ORIENTATION, RATIO, QUALITY).then((result) => {
                    this.selectedQstImage = result;
                    this.questionForm.patchValue({ qstImage: { data: result, name: file.name } });
                    this.fileName = file.name;
                });
            };
            /*
                FileReader reads the file and the result is a Data URL, which is a string that represents the file's data encoded in base64 format 
                and can be used as a source for an <img> tag or as a background image in CSS.
            */
            reader.readAsDataURL(file);
        }
    }
}
