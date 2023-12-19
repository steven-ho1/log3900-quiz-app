import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HttpClientTestingModule } from '@angular/common/http/testing';
import { GameHandlingService } from '@app/services/game-handling/game-handling.service';
import { HistogramComponent } from './histogram.component';

describe('HistogramComponent', () => {
    let component: HistogramComponent;
    let fixture: ComponentFixture<HistogramComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [HistogramComponent],
            imports: [HttpClientTestingModule],
        });
        fixture = TestBed.createComponent(HistogramComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('isCurrentQuestionQcm getter should call and return value of isCurrentQuestionQcm method of GameHandlingService', () => {
        const gameHandlerSpy = spyOn(TestBed.inject(GameHandlingService), 'isCurrentQuestionQcm').and.returnValue(true);
        expect(component.isCurrentQuestionQcm).toBeTrue();
        expect(gameHandlerSpy).toHaveBeenCalled();

        gameHandlerSpy.and.returnValue(false);
        expect(component.isCurrentQuestionQcm).toBeFalse();
    });
});
