import { Component, Inject, OnInit } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ImportStates } from '@app/constants/enums';
import { FormManagerService } from '@app/services/form-manager/form-manager.service';
import { Game } from '@common/game';
import { Limit } from '@common/limit';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-game-import-popup',
    templateUrl: './game-import-popup.component.html',
    styleUrls: ['./game-import-popup.component.scss'],
})
export class GameImportPopupComponent implements OnInit {
    games: Game[];
    gameForm: FormGroup = this.formManager.gameForm;
    importState: string = '';
    maxTitleLength = Limit.MaxTitleLength;
    importedGame: Game;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { importedGame: Game; games: Game[]; fileName: string },
        public dialogRef: MatDialogRef<GameImportPopupComponent>,
        private formManager: FormManagerService,
    ) {}

    ngOnInit(): void {
        this.games = this.data.games;
        this.importedGame = this.data.importedGame;
        this.getImportState();
    }

    getImportState() {
        this.gameForm = this.formManager.initializeImportForm(this.importedGame);
        if (!this.gameForm.value.title || typeof this.gameForm.value.title !== typeof '') {
            window.alert('Titre du questionnaire absent');
            this.closeDialog();
            return;
        }
        if (this.titleAlreadyExists()) {
            this.importState = ImportStates.NameExists;
        } else {
            this.importState = ImportStates.ValidForm;
            this.onSubmit();
        }
    }

    closeDialog(newGames?: Game[]) {
        this.formManager.resetGameForm();
        this.dialogRef.close(newGames);
    }

    titleAlreadyExists(): boolean {
        for (const game of this.games) {
            if (game.title.toLowerCase().trim() === this.gameForm.value.title.toLowerCase().trim()) return true;
        }
        return false;
    }

    isNewTitleEmpty(): boolean {
        return this.gameForm.value.title.trim().length === 0;
    }

    onSubmit() {
        const response: Observable<Game[]> | void = this.formManager.sendGameForm(this.gameForm);
        if (response) {
            response.subscribe((games: Game[]) => {
                this.closeDialog(games);
            });
        }
    }
}
