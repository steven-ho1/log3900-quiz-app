import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Route } from '@app/constants/enums';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { Game } from '@common/game';
import { Limit } from '@common/limit';

@Component({
    selector: 'app-quiz-creation-page',
    templateUrl: './quiz-creation-page.component.html',
    styleUrls: ['./quiz-creation-page.component.scss'],
})
export class QuizCreationPageComponent implements OnInit, OnDestroy {
    adminRoute: string = '/' + Route.Admin;
    pageTitle: string = "Création d'un jeu";
    maxTitleLength: number;
    maxDescriptionLength: number;
    isNameDuplicate = false;
    isNameEmpty = false;
    isDescEmpty = false;
    isTimerInvalid = false;
    games: Game[];
    gameForm: FormGroup = this.formManager.gameForm;
    nameModif: string;
    isAccessingQuestionCreation = false;

    constructor(
        private gameHandler: GameHandlingService,
        private formManager: FormManagerService,
        private router: Router,
    ) {
        this.maxTitleLength = Limit.MaxTitleLength;
        this.maxDescriptionLength = Limit.MaxDescriptionLength;
    }

    ngOnInit(): void {
        this.nameModif = this.formManager.nameModif;
        this.gameHandler.getGames().subscribe((games) => {
            this.games = games;
        });
    }

    ngOnDestroy(): void {
        if (this.isAccessingQuestionCreation) return;
        this.formManager.resetGameForm();
    }

    // Verification des requis pour un quiz

    verifyName(event: Event): void {
        this.isNameEmpty = !(event.target as HTMLInputElement).value.trim();

        if ((event.target as HTMLInputElement).value.trim().toLowerCase() === this.nameModif.toLowerCase() && !this.isNameEmpty) {
            this.isNameDuplicate = false;
            return;
        }
        this.verifyNameDuplicate((event.target as HTMLInputElement).value);
    }

    verifyNameDuplicate(name: string): void {
        for (const game of this.games) {
            this.isNameDuplicate = game.title.toLowerCase() === name.trim().toLowerCase();
            if (this.isNameDuplicate) return;
        }
    }

    verifyDesc(event: Event) {
        this.isDescEmpty = !(event.target as HTMLInputElement).value.trim();
    }

    verifyTimer(event: Event) {
        this.isTimerInvalid =
            !(event.target as HTMLInputElement).value.trim() ||
            Number((event.target as HTMLInputElement).value) < Limit.MinDuration ||
            Number((event.target as HTMLInputElement).value) > Limit.MaxDuration;
    }

    hasQuestions(): boolean {
        return this.formManager.hasQuestions();
    }

    accessQuestionCreation(): void {
        this.isAccessingQuestionCreation = true;
        this.router.navigate([Route.QuestionCreation]);
    }

    onSubmit(): void {
        this.formManager.sendGameForm();
    }
}
