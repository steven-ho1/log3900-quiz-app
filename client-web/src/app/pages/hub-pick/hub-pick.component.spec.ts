import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HubPickComponent } from './hub-pick.component';

describe('HubPickComponent', () => {
    let component: HubPickComponent;
    let fixture: ComponentFixture<HubPickComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [HubPickComponent],
        });
        fixture = TestBed.createComponent(HubPickComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
