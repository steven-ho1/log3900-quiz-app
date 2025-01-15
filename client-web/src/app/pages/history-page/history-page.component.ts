import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Route } from '@app/constants/enums';
import { SNACK_BAR_ERROR_CONFIGURATION } from '@app/constants/snack-bar-configuration';
import { AuthService } from '@app/services/auth/auth.service';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { GameInfo } from '@common/game';
import { Language } from '@common/user';
import { TranslateService } from '@ngx-translate/core';
import { StatusCodes } from 'http-status-codes';

const SORT_FALSE = -1;
const SORT_TRUE = 1;
const ARROW_UP = ' ▲';
const ARROW_DOWN = ' ▼';

@Component({
    selector: 'app-history-page',
    templateUrl: './history-page.component.html',
    styleUrls: ['./history-page.component.scss'],
})
export class HistoryPageComponent implements OnInit {
    backgroundImage;
    adminRoute: string = '/' + Route.Admin;
    games: GameInfo[] = [];
    isNameSortedAscending: boolean = false;
    isDateSortedAscending: boolean = false;
    arrowName: string = '';
    arrowDate: string = '';
    currentLanguage: string;
    private translate: TranslateService = inject(TranslateService);

    constructor(
        private gameHandling: GameHandlingService,
        private snackBar: MatSnackBar,
        private authService: AuthService,
    ) {
        this.backgroundImage = this.authService.getBackgroundImage();
        this.currentLanguage = this.translate.currentLang;
        this.translate.onLangChange.subscribe((event) => {
            this.currentLanguage = event.lang;
        });
    }

    ngOnInit() {
        this.gameHandling.getHistory().subscribe({
            next: (infos) => {
                this.games = infos;
            },
            error: (error: HttpErrorResponse) => {
                if (error.status === StatusCodes.NOT_FOUND) {
                    this.snackBar.open(
                        this.currentLanguage === Language.French ? 'Historique introuvable' : 'History not found',
                        '',
                        SNACK_BAR_ERROR_CONFIGURATION,
                    );
                }
            },
        });
    }

    resetList() {
        this.gameHandling.resetHistory().subscribe({
            next: () => {
                this.games = [];
            },
            error: () => {
                return;
            },
        });
    }

    listIsEmpty(): boolean {
        return this.games.length === 0;
    }
    // Sort les parties selon leur nom
    sortName() {
        if (!this.isNameSortedAscending) {
            this.games.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? SORT_TRUE : SORT_FALSE));
            this.arrowName = ARROW_UP;
        } else {
            this.games.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? SORT_FALSE : SORT_TRUE));
            this.arrowName = ARROW_DOWN;
        }

        this.isNameSortedAscending = !this.isNameSortedAscending;
        this.isDateSortedAscending = false;
        this.arrowDate = '';
    }
    // Sort les parties selon la date de jeu
    sortDate() {
        if (!this.isDateSortedAscending) {
            this.games.sort((a, b) => (a.date > b.date ? SORT_TRUE : SORT_FALSE));
            this.arrowDate = ARROW_UP;
        } else {
            this.games.sort((a, b) => (a.date > b.date ? SORT_FALSE : SORT_TRUE));
            this.arrowDate = ARROW_DOWN;
        }

        this.isDateSortedAscending = !this.isDateSortedAscending;
        this.isNameSortedAscending = false;
        this.arrowName = '';
    }
}
