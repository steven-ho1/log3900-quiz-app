import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetCodeFormComponent } from './reset-code-form.component';

describe('ResetCodeFormComponent', () => {
    let component: ResetCodeFormComponent;
    let fixture: ComponentFixture<ResetCodeFormComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [ResetCodeFormComponent],
        });
        fixture = TestBed.createComponent(ResetCodeFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
