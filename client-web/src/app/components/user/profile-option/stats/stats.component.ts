import { Component } from '@angular/core';
import { StatsService } from '@app/services/stats/stats.service';
import { PlayerStats } from '@common/stats';

@Component({
    selector: 'app-stats',
    templateUrl: './stats.component.html',
    styleUrls: ['./stats.component.scss'],
})
export class StatsComponent {
    totalGamesPlayed: number | undefined;
    totalGamesWon: number | undefined;

    constructor(private statsService: StatsService) {
        this.totalGamesPlayed = this.playerStats?.completedGames.length;
        this.totalGamesWon = this.computeTotalGamesWon();
    }
    get playerStats(): PlayerStats | null | undefined {
        return this.statsService.getPlayerStats();
    }

    private computeTotalGamesWon() {
        return this.playerStats?.completedGames.reduce((total, completedGame) => {
            return total + Number(completedGame.hasWon);
        }, 0);
    }
}
