import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockedPlayerWarningComponent } from './blocked-player-warning.component';

describe('BlockedPlayerWarningComponent', () => {
    let component: BlockedPlayerWarningComponent;
    let fixture: ComponentFixture<BlockedPlayerWarningComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [BlockedPlayerWarningComponent],
        });
        fixture = TestBed.createComponent(BlockedPlayerWarningComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
