import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterModule, convertToParamMap } from '@angular/router';
import { HeaderComponent } from '@app/components/header/header.component';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { GameInfo } from '@common/game';
import { of } from 'rxjs';
import { HistoryPageComponent } from './history-page.component';

describe('HistoryPageComponent', () => {
    let component: HistoryPageComponent;
    let fixture: ComponentFixture<HistoryPageComponent>;
    let gameHandlerSpy: jasmine.SpyObj<GameHandlingService>;

    const game: GameInfo = { name: 'test', date: 'test2', numberPlayers: 1, bestScore: 200 };

    beforeEach(() => {
        gameHandlerSpy = jasmine.createSpyObj('GameHandlingService', ['getHistory', 'resetHistory']);
        gameHandlerSpy.getHistory.and.returnValue(of([game]));
        gameHandlerSpy.resetHistory.and.returnValue(of([]));
        TestBed.configureTestingModule({
            declarations: [HistoryPageComponent, HeaderComponent],
            imports: [MatIconModule, RouterModule, HttpClientTestingModule, MatSnackBarModule],
            providers: [
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
                { provide: GameHandlingService, useValue: gameHandlerSpy },
            ],
        });
        fixture = TestBed.createComponent(HistoryPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('onInit should get the list of games', () => {
        component.ngOnInit();
        expect(component.games).toEqual([game]);
    });

    it('resetList should call resetHistory from the game handler and update the list', () => {
        component.resetList();
        expect(gameHandlerSpy.resetHistory).toHaveBeenCalled();
        expect(component.games).toEqual([]);
    });

    it('listIsEmpty should return true if the list is empty', () => {
        expect(component.listIsEmpty()).toBeFalse();
        component.resetList();
        expect(component.listIsEmpty()).toBeTrue();
    });

    it('sortName should sort the list ascending', () => {
        const game2: GameInfo = { name: 'a test', date: '', numberPlayers: 0, bestScore: 1000 };
        component.games = [game, game2];

        component.sortName();
        expect(component.games).toEqual([game2, game]);
        expect(component.isNameSortedAscending).toBeTrue();

        component.isNameSortedAscending = false;
        component.sortName();
        expect(component.games).toEqual([game2, game]);
        expect(component.isNameSortedAscending).toBeTrue();
    });

    it('sortName should sort the list descending if the list is sorted ascending', () => {
        const game2: GameInfo = { name: 'ze test', date: '', numberPlayers: 0, bestScore: 1000 };
        component.games = [game, game2];
        component.isNameSortedAscending = true;

        component.sortName();
        expect(component.games).toEqual([game2, game]);
        expect(component.isNameSortedAscending).toBeFalse();

        component.isNameSortedAscending = true;
        component.sortName();
        expect(component.games).toEqual([game2, game]);
        expect(component.isNameSortedAscending).toBeFalse();
    });

    it('sortDate should sort the list ascending', () => {
        const game2: GameInfo = { name: 'a test', date: 'ze test', numberPlayers: 0, bestScore: 1000 };
        component.games = [game2, game];

        component.sortDate();
        expect(component.games).toEqual([game, game2]);
        expect(component.isDateSortedAscending).toBeTrue();

        component.isDateSortedAscending = false;
        component.sortDate();
        expect(component.games).toEqual([game, game2]);
        expect(component.isDateSortedAscending).toBeTrue();
    });

    it('sortDate should sort the list descending if the list is sorted ascending', () => {
        const game2: GameInfo = { name: 'ze test', date: 'a test', numberPlayers: 0, bestScore: 1000 };
        component.games = [game2, game];
        component.isDateSortedAscending = true;

        component.sortDate();
        expect(component.games).toEqual([game, game2]);
        expect(component.isNameSortedAscending).toBeFalse();

        component.isDateSortedAscending = true;
        component.sortDate();
        expect(component.games).toEqual([game, game2]);
        expect(component.isDateSortedAscending).toBeFalse();
    });
});
