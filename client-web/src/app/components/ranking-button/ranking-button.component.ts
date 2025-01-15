import { Component } from '@angular/core';
import { Route } from '@app/constants/enums';

@Component({
    selector: 'app-ranking-button',
    templateUrl: './ranking-button.component.html',
    styleUrls: ['./ranking-button.component.scss'],
})
export class RankingButtonComponent {
    rankingRoute: string = '/' + Route.Ranking;
}
