import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetRequestFormComponent } from './reset-request-form.component';

describe('ResetRequestFormComponent', () => {
    let component: ResetRequestFormComponent;
    let fixture: ComponentFixture<ResetRequestFormComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [ResetRequestFormComponent],
        });
        fixture = TestBed.createComponent(ResetRequestFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
