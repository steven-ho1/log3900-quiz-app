import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RankingButtonComponent } from './ranking-button.component';

describe('RankingButtonComponent', () => {
    let component: RankingButtonComponent;
    let fixture: ComponentFixture<RankingButtonComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [RankingButtonComponent],
        });
        fixture = TestBed.createComponent(RankingButtonComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
