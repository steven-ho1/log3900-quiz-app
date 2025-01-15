import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, inject } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { QuestionCreationPopupComponent } from '@app/components/question-creation-popup/question-creation-popup.component';
import { Route } from '@app/constants/enums';
import { AuthService } from '@app/services/auth/auth.service';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Question, QuestionType } from '@common/game';
import { Limit } from '@common/limit';
import { Language } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import * as lodash from 'lodash-es';

export const QCM_COLOR = '#1F7DF1';
export const QRL_COLOR = '#FF6400';
export const QRE_COLOR = '#2ECC71';

@Component({
    selector: 'app-question-creation-page',
    templateUrl: './question-creation-page.component.html',
    styleUrls: ['./question-creation-page.component.scss'],
})
export class QuestionCreationPageComponent {
    backgroundImage;
    quizCreationRoute: string = '/' + Route.QuizCreation;
    isAccessingQuizCreation: boolean = false;
    pageTitle: string = 'Questions';
    gameName: string = this.formManager.gameForm.value.title;
    gameNameUnavailable: string;
    questionsFormArray: FormArray = lodash.cloneDeep(this.formManager.questions) as FormArray;
    private currentLanguage: string;
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private dialog: MatDialog,
        private formManager: FormManagerService,
        private authService: AuthService,
    ) {
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
        this.backgroundImage = this.authService.getBackgroundImage();
        this.gameNameUnavailable = this.currentLanguage === Language.French ? 'À déterminer' : 'To define';
    }

    setQuestionStyle(question: Question) {
        if (question.type === QuestionType.QCM) return { background: QCM_COLOR };
        else if (question.type === QuestionType.QRE) return { background: QRE_COLOR };
        return { background: QRL_COLOR };
    }
    // Gestion du drag and drop des choix
    drop(event: CdkDragDrop<Question[]>): void {
        moveItemInArray(this.questionsFormArray.controls, event.previousIndex, event.currentIndex);
    }

    openQuestionCreator(index?: number): void {
        const questionsFormArray = this.questionsFormArray;

        const questionPopup: MatDialogRef<QuestionCreationPopupComponent, FormGroup> = this.dialog.open(QuestionCreationPopupComponent, {
            data: { questionsFormArray, index },
            width: '80%',
            height: '90%',
            backdropClass: 'backdropBackground',
            disableClose: true,
        });

        questionPopup.afterClosed().subscribe({
            next: (questionForm: FormGroup | undefined) => {
                if (questionForm) {
                    if (index === undefined) {
                        this.questionsFormArray.push(questionForm);
                    } else {
                        this.questionsFormArray.controls[index] = questionForm;
                    }
                }
            },
            error: () => {
                return;
            },
        });
    }

    deleteQuestion(index: number) {
        this.questionsFormArray.removeAt(index);
    }

    saveQuestions(): void {
        this.formManager.saveQuestions(this.questionsFormArray);
    }

    isEmpty(): boolean {
        return this.questionsFormArray.length < Limit.MinQuestionsNumber;
    }

    getQuestionType(questionType: QuestionType) {
        switch (questionType) {
            case QuestionType.QCM:
                return this.currentLanguage === Language.French ? 'QCM' : 'MCQ';
            case QuestionType.QRL:
                return this.currentLanguage === Language.French ? 'QRL' : 'OEQ';

            case QuestionType.QRE:
                return this.currentLanguage === Language.French ? 'QRE' : 'EQ';
        }
    }
}
