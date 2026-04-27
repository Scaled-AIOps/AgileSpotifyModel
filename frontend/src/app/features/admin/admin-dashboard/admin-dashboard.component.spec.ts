import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { OrgApi, HeadcountEntry } from '../../../core/api/org.api';
import { AuthService } from '../../../core/auth/auth.service';

const HEADCOUNT: HeadcountEntry[] = [
  { id: 't1', name: 'Tribe A', memberCount: 10, squads: [{ id: 's1', name: 'Squad A', memberCount: 5 }] },
  { id: 't2', name: 'Tribe B', memberCount: 20, squads: [] },
];

describe('AdminDashboardComponent', () => {
  let orgSpy: jasmine.SpyObj<OrgApi>;
  let component: AdminDashboardComponent;

  beforeEach(async () => {
    orgSpy = jasmine.createSpyObj('OrgApi', ['getHeadcount', 'getTree']);
    orgSpy.getHeadcount.and.returnValue(of(HEADCOUNT));
    orgSpy.getTree.and.returnValue(of([]));

    const authStub = { currentUser: () => ({ email: 'a@b.com', role: 'Admin' }) };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: OrgApi, useValue: orgSpy },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and load headcount', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.headcount.length).toBe(2);
  });

  it('barWidth calculates correct percentage', () => {
    expect(component.barWidth(20)).toBe('100%');
    expect(component.barWidth(10)).toBe('50%');
  });

  it('isFullAdmin returns true for Admin', () => {
    expect(component.isFullAdmin).toBeTrue();
  });

  it('barWidth handles zero maxCount', () => {
    orgSpy.getHeadcount.and.returnValue(of([]));
    const fixture = TestBed.createComponent(AdminDashboardComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.barWidth(0)).toBe('0%');
  });
});
