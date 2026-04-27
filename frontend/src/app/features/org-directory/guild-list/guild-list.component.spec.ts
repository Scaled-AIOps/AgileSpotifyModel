import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { GuildListComponent } from './guild-list.component';
import { GuildApi } from '../../../core/api/guild.api';

describe('GuildListComponent', () => {
  let guildSpy: jasmine.SpyObj<GuildApi>;

  beforeEach(async () => {
    guildSpy = jasmine.createSpyObj('GuildApi', ['getAll', 'create', 'delete', 'getMembers']);
    guildSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [GuildListComponent],
      providers: [
        provideRouter([]),
        { provide: GuildApi, useValue: guildSpy },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(GuildListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
