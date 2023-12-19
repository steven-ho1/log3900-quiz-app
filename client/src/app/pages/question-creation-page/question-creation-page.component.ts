import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { QuestionCreationPopupComponent } from '@app/components/question-creation-popup/question-creation-popup.component';
import { Route } from '@app/constants/enums';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Question, QuestionType } from '@common/game';
import { Limit } from '@common/limit';
import * as lodash from 'lodash-es';

export const QCM_COLOR = '#1F7DF1';
export const QRL_COLOR = '#FF6400';

@Component({
    selector: 'app-question-creation-page',
    templateUrl: './question-creation-page.component.html',
    styleUrls: ['./question-creation-page.component.scss'],
})
export class QuestionCreationPageComponent {
    quizCreationRoute: string = '/' + Route.QuizCreation;
    isAccessingQuizCreation: boolean = false;
    pageTitle: string = 'Liste des questions';
    gameName: string = this.formManager.gameForm.value.title;
    gameNameUnavailable: string = 'À déterminer';
    questionsFormArray: FormArray = lodash.cloneDeep(this.formManager.questions) as FormArray;

    constructor(
        private dialog: MatDialog,
        private formManager: FormManagerService,
    ) {}

    setQuestionStyle(question: Question) {
        if (question.type === QuestionType.QCM) return { background: QCM_COLOR };
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
            width: '70%',
            height: '85%',
            backdropClass: 'backdropBackground',
            disableClose: true,
        });

        questionPopup.afterClosed().subscribe((questionForm: FormGroup | undefined) => {
            if (questionForm) {
                if (index === undefined) {
                    this.questionsFormArray.push(questionForm);
                } else {
                    this.questionsFormArray.controls[index] = questionForm;
                }
            }
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
}
