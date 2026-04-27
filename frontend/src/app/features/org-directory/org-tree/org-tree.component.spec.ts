import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrgTreeComponent } from './org-tree.component';
import { OrgApi } from '../../../core/api/org.api';

describe('OrgTreeComponent', () => {
  let orgSpy: jasmine.SpyObj<OrgApi>;
  let component: OrgTreeComponent;

  beforeEach(async () => {
    orgSpy = jasmine.createSpyObj('OrgApi', ['getTree', 'getHeadcount']);
    orgSpy.getTree.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [OrgTreeComponent],
      providers: [
        provideRouter([]),
        { provide: OrgApi, useValue: orgSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OrgTreeComponent);
    component = fixture.componentInstance;
  });

  it('should create without error', () => {
    expect(component).toBeTruthy();
  });

  describe('buildTreeData', () => {
    it('returns root node for empty domains', () => {
      const result = (component as any).buildTreeData([]);
      expect(result.name).toBe('Organisation');
      expect(result.type).toBe('root');
      expect(result.children.length).toBe(0);
    });

    it('builds tree with subdomains, tribes, and squads', () => {
      const domains = [{
        id: 'd1', name: 'Domain A',
        subdomains: [{
          id: 'sd1', name: 'Sub A',
          tribes: [{
            id: 't1', name: 'Tribe A',
            squads: [
              { id: 'sq1', name: 'Squad X', memberCount: 5, appCount: 3 },
              { id: 'sq2', name: 'Squad Y', memberCount: 2, appCount: 0 },
            ],
          }],
        }],
        tribes: [{
          id: 't2', name: 'Direct Tribe',
          squads: [
            { id: 'sq3', name: 'Squad Z', memberCount: 1, appCount: 1 },
          ],
        }],
      }] as any;

      const result = (component as any).buildTreeData(domains);
      expect(result.children.length).toBe(1);
      const domain = result.children[0];
      expect(domain.name).toBe('Domain A');
      expect(domain.type).toBe('domain');
      expect(domain.children.length).toBe(2);

      const sdNode = domain.children[0];
      expect(sdNode.type).toBe('subdomain');
      expect(sdNode.children[0].type).toBe('tribe');
      const squads = sdNode.children[0].children;
      expect(squads[0].name).toContain('· 3 apps');
      expect(squads[1].name).not.toContain('apps');

      const directTribe = domain.children[1];
      expect(directTribe.type).toBe('tribe');
      expect(directTribe.children[0].name).toContain('· 1 apps');
    });

    it('handles domains with null subdomains and tribes', () => {
      const domains = [{ id: 'd1', name: 'Domain B', subdomains: null, tribes: null }] as any;
      const result = (component as any).buildTreeData(domains);
      expect(result.children[0].children.length).toBe(0);
    });

    it('handles tribes with null squads', () => {
      const domains = [{
        id: 'd1', name: 'Domain C',
        subdomains: [{ id: 'sd1', name: 'Sub C', tribes: [{ id: 't1', name: 'T', squads: null }] }],
        tribes: [],
      }] as any;
      const result = (component as any).buildTreeData(domains);
      expect(result.children[0].children[0].children[0].children.length).toBe(0);
    });
  });
});
