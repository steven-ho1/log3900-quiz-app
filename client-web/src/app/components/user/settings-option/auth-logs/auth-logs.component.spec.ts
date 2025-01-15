import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthLogsComponent } from './auth-logs.component';

describe('AuthLogsComponent', () => {
    let component: AuthLogsComponent;
    let fixture: ComponentFixture<AuthLogsComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [AuthLogsComponent],
        });
        fixture = TestBed.createComponent(AuthLogsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
