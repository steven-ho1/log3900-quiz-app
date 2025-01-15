import { Component } from '@angular/core';
import { StatsService } from '@app/services/stats/stats.service';
import { PlayerStats } from '@common/stats';

@Component({
    selector: 'app-match-history',
    templateUrl: './match-history.component.html',
    styleUrls: ['./match-history.component.scss'],
})
export class MatchHistoryComponent {
    protected firstColumn: string = 'completionDate';
    protected secondColumn: string = 'hasWon';
    protected displayedColumns: string[] = [this.firstColumn, this.secondColumn];

    constructor(private statsService: StatsService) {}

    get playerStats(): PlayerStats | null | undefined {
        return this.statsService.getPlayerStats();
    }
}
