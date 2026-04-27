import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SquadPickerComponent } from './squad-picker.component';
import { SquadApi } from '../../../core/api/squad.api';

describe('SquadPickerComponent', () => {
  let squadSpy: jasmine.SpyObj<SquadApi>;

  beforeEach(async () => {
    squadSpy = jasmine.createSpyObj('SquadApi', ['getAll']);
    squadSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [SquadPickerComponent],
      providers: [
        provideRouter([]),
        { provide: SquadApi, useValue: squadSpy },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(SquadPickerComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
