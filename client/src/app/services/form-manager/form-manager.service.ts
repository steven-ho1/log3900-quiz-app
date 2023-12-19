import { formatDate } from '@angular/common';
import { Injectable } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game } from '@common/game';
import { Observable } from 'rxjs';

const BASE_TIMER = 30;

@Injectable({
    providedIn: 'root',
})
export class FormManagerService {
    gameForm: FormGroup = this.createBaseForm();
    nameModif = '';

    constructor(
        private fb: FormBuilder,
        private gameHandler: GameHandlingService,
        private router: Router,
    ) {}

    get questions(): FormArray {
        return this.gameForm.get('questions') as FormArray;
    }

    initializeImportForm(gameData: Game): FormGroup {
        return (this.gameForm = this.fb.group({
            id: gameData.id,
            title: gameData.title,
            description: gameData.description,
            duration: gameData.duration,
            lastModification: formatDate(new Date(), 'yyyy-MM-dd   h:mm:ss a', 'en'),
            isVisible: false,
            questions: this.fb.array(gameData.questions),
        }));
    }

    resetGameForm(): void {
        this.gameForm = this.createBaseForm();
        this.nameModif = '';
    }

    modifyGame(): void {
        this.gameForm.value.lastModification = formatDate(new Date(), 'yyyy-MM-dd   h:mm:ss a', 'en');
        this.gameHandler.modifyGame(this.gameForm.value).subscribe(() => {
            this.resetGameForm();
            this.router.navigate([Route.Admin]);
        });
    }

    addGame(): void {
        this.gameHandler.addGame(this.gameForm.value).subscribe(() => {
            this.resetGameForm();
            this.router.navigate([Route.Admin]);
        });
    }

    sendGameForm(importedGameForm?: FormGroup): void | Observable<Game[]> {
        if (this.nameModif) this.modifyGame();
        else if (importedGameForm === undefined) this.addGame();
        else return this.gameHandler.addGame(importedGameForm.value);
    }

    hasQuestions(): boolean {
        return this.questions.length > 0;
    }

    preventEmptyInput(control: AbstractControl) {
        const whiteSpaceRemoved = control.value.trim();
        return whiteSpaceRemoved.length === 0 ? { isEmpty: true } : null;
    }

    saveQuestions(questionsFormArray: FormArray) {
        this.questions.clear();

        for (let i = 0; i < questionsFormArray.length; i++) this.questions.push(questionsFormArray.at(i));
    }

    private createBaseForm(): FormGroup {
        const baseForm: FormGroup = this.fb.group({
            id: 0,
            title: ['', Validators.required],
            description: ['', Validators.required],
            duration: [BASE_TIMER, Validators.required],
            lastModification: formatDate(new Date(), 'yyyy-MM-dd   h:mm:ss a', 'en'),
            isVisible: false,
            questions: this.fb.array([]),
        });

        return baseForm;
    }
}
