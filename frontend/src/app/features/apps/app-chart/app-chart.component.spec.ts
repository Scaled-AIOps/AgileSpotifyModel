import { TestBed } from '@angular/core/testing';
import { AppChartComponent } from './app-chart.component';
import type { AppDeployment } from '../../../core/models/index';

const mkDeploy = (version: string, state: AppDeployment['state'] = 'success'): AppDeployment => ({
  appId: 'auth-api', env: 'prd', version, commitId: 'sha', branch: 'main',
  deployedBy: 'ci-bot', state, deployedAt: '2026-04-28T10:00:00.000Z',
  notes: '', xray: '', javaVersion: '', javaComplianceStatus: '', changeRequest: '',
});

function newComponent() {
  TestBed.configureTestingModule({ imports: [AppChartComponent] });
  return TestBed.createComponent(AppChartComponent).componentInstance;
}

describe('AppChartComponent', () => {
  describe('hasData', () => {
    it('returns false on empty inputs', () => {
      const c = newComponent();
      expect(c.hasData).toBeFalse();
    });

    it('returns true when ocp has any platform', () => {
      const c = newComponent();
      c.ocp = { intPlatform: 'cluster-int' } as any;
      expect(c.hasData).toBeTrue();
    });

    it('returns true when only buildChart/chart set', () => {
      const c = newComponent();
      c.gcp = { buildChart: 'gcp-build' } as any;
      expect(c.hasData).toBeTrue();
    });

    it('returns true when history has entries', () => {
      const c = newComponent();
      c.history = { prd: [mkDeploy('1.0.0')] };
      expect(c.hasData).toBeTrue();
    });
  });

  describe('buildTree', () => {
    it('builds app → cloud → env → version hierarchy', () => {
      const c = newComponent();
      c.appId = 'auth-api';
      c.ocp = {
        intPlatform: 'backend-int', uatPlatform: 'backend-uat', prdPlatform: 'backend-prd',
        intUrl: 'https://int.example.com', uatUrl: 'https://uat.example.com', prdUrl: 'https://prd.example.com',
        buildChart: 'ocp-build', chart: 'ocp-node',
      } as any;
      c.gcp = { prdPlatform: 'gcp-prd' } as any;
      c.history = { prd: [mkDeploy('1.2.0'), mkDeploy('1.1.0'), mkDeploy('1.0.0')] };

      const root = c.buildTree();
      expect(root.name).toBe('auth-api');
      expect(root.type).toBe('app');

      // Two clouds (ocp + gcp)
      expect(root.children!.length).toBe(2);
      const ocp = root.children!.find((n) => n.name === 'OCP')!;
      const gcp = root.children!.find((n) => n.name === 'GCP')!;
      expect(ocp.meta).toBe('ocp-node · ocp-build');

      // OCP has int, uat, prd envs
      expect(ocp.children!.length).toBe(3);
      const prdEnv = ocp.children!.find((n) => n.name === 'prd')!;
      expect(prdEnv.meta).toBe('backend-prd');

      // 3 versions under prd
      expect(prdEnv.children!.length).toBe(3);
      expect(prdEnv.children![0].name).toBe('v1.2.0');
      expect(prdEnv.children![0].state).toBe('success');

      // GCP has only prd
      expect(gcp.children!.length).toBe(1);
      expect(gcp.children![0].name).toBe('prd');
    });

    it('caps version children at MAX_VERSIONS_PER_ENV (5)', () => {
      const c = newComponent();
      c.appId = 'app';
      c.ocp = { prdPlatform: 'cluster' } as any;
      c.history = { prd: Array.from({ length: 9 }, (_, i) => mkDeploy(`1.${i}.0`)) };

      const root = c.buildTree();
      const prd = root.children![0].children![0];
      expect(prd.children!.length).toBe(5);
    });

    it('skips clouds with no envs and no chart info', () => {
      const c = newComponent();
      c.appId = 'app';
      c.ocp = {} as any;
      c.gcp = {} as any;

      const root = c.buildTree();
      expect(root.children!.length).toBe(0);
    });

    it('uses URL host as env meta when no platform name is set', () => {
      const c = newComponent();
      c.appId = 'app';
      c.ocp = { prdUrl: 'https://gw-prd.example.com/path' } as any;

      const root = c.buildTree();
      const prd = root.children![0].children![0];
      expect(prd.meta).toBe('gw-prd.example.com');
    });
  });
});
