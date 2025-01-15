import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CredentialContainerComponent } from './credential-container.component';

describe('CredentialFieldsComponent', () => {
    let component: CredentialContainerComponent;
    let fixture: ComponentFixture<CredentialContainerComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [CredentialContainerComponent],
        });
        fixture = TestBed.createComponent(CredentialContainerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
