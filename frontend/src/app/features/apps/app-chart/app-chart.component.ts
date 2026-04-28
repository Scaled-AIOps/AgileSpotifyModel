/**
 * Purpose: D3 collapsible tree visualisation for an application's deployment
 *          topology — app → cloud (ocp/gcp) → environment → version.
 * Usage:   `<app-app-chart [appId]="appId" [ocp]="ocp" [gcp]="gcp"
 *           [history]="history">` — embedded in app-detail; reads the same
 *          per-env deployment history that the deployment grid uses.
 * Goal:    Give a single picture of where an app runs and which versions are
 *          live in each environment, mirroring the /org/tree experience.
 * ToDo:    Persist collapse state across navigations; click a version node to
 *          scroll to the matching row in the deploy-history table.
 */
import {
  Component, Input, OnChanges, OnDestroy, ElementRef, ViewChild, AfterViewInit,
  ChangeDetectorRef, inject,
} from '@angular/core';
import * as d3 from 'd3';
import type { AppDeployment, CloudPlatform } from '../../../core/models/index';

interface ChartNode {
  id: string;
  name: string;
  type: 'app' | 'cloud' | 'env' | 'version';
  meta?: string;            // platform name for env nodes; deploy state for version nodes
  state?: string;           // deploy state colours version nodes
  children?: ChartNode[];
  _collapsed?: boolean;
}

const ENVS = ['local', 'dev', 'int', 'uat', 'prd'] as const;
const MAX_VERSIONS_PER_ENV = 5;

@Component({
  selector: 'app-app-chart',
  standalone: true,
  imports: [],
  template: `
    <div class="app-chart">
      <div class="legend">
        <span class="legend-item"><span class="dot dot-app"></span>App</span>
        <span class="legend-item"><span class="dot dot-cloud"></span>Cloud</span>
        <span class="legend-item"><span class="dot dot-env"></span>Environment</span>
        <span class="legend-item"><span class="dot dot-version"></span>Version</span>
      </div>
      @if (!hasData) {
        <div class="empty">No deployments to chart yet.</div>
      } @else {
        <div #chartContainer class="chart-container"></div>
      }
    </div>
  `,
  styles: [`
    .app-chart { padding: 8px 0; }
    .legend { display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
    .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .dot-app     { background: #6d28d9; border: 2px solid #4c1d95; }
    .dot-cloud   { background: #3f51b5; border: 2px solid #1a237e; }
    .dot-env     { background: #26a69a; border: 2px solid #00695c; }
    .dot-version { background: #66bb6a; border: 2px solid #2e7d32; }
    .empty { padding: 24px; color: var(--text-muted); font-style: italic; text-align: center; border: 1px dashed var(--border); border-radius: var(--radius); }
    .chart-container { width: 100%; overflow: auto; min-height: 220px; }
    :host ::ng-deep .node circle { stroke-width: 2; cursor: pointer; }
    :host ::ng-deep .node text { font-size: 12px; font-family: sans-serif; }
    :host ::ng-deep .node text.meta { font-size: 10px; fill: var(--text-muted); }
    :host ::ng-deep .link { fill: none; stroke: #ccc; stroke-width: 1.5px; }
    :host ::ng-deep .node.app circle     { fill: #6d28d9; stroke: #4c1d95; }
    :host ::ng-deep .node.cloud circle   { fill: #3f51b5; stroke: #1a237e; }
    :host ::ng-deep .node.env circle     { fill: #26a69a; stroke: #00695c; }
    :host ::ng-deep .node.version circle { fill: #66bb6a; stroke: #2e7d32; }
    :host ::ng-deep .node.version.failed     circle { fill: #e53e3e; stroke: #991b1b; }
    :host ::ng-deep .node.version.rolledback circle { fill: #d97706; stroke: #92400e; }
    :host ::ng-deep .node.version.pending    circle { fill: #f59e0b; stroke: #b45309; }
  `],
})
export class AppChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartContainer') private containerRef?: ElementRef<HTMLDivElement>;
  private cdr = inject(ChangeDetectorRef);

  @Input() appId = '';
  @Input() ocp: CloudPlatform = {};
  @Input() gcp: CloudPlatform = {};
  /** Per-env deploy history, e.g. history['prd'] → newest-first list. */
  @Input() history: Record<string, AppDeployment[]> = {};

  get hasData(): boolean {
    const cloudHasAny = (b: CloudPlatform) =>
      ENVS.some((e) => (b as any)[`${e}Platform`] || (b as any)[`${e}Url`]) ||
      !!(b.buildChart || b.chart);
    const anyCloud   = cloudHasAny(this.ocp) || cloudHasAny(this.gcp);
    const anyHistory = Object.values(this.history).some((h) => h && h.length);
    return anyCloud || anyHistory;
  }

  ngAfterViewInit() { this.cdr.detectChanges(); this.render(); }
  ngOnChanges()     { setTimeout(() => this.render(), 0); }

  ngOnDestroy() {
    if (this.containerRef?.nativeElement) {
      d3.select(this.containerRef.nativeElement).selectAll('*').remove();
    }
  }

  /** Internal — exposed (not private) so unit tests can assert the tree shape without going through D3. */
  buildTree(): ChartNode {
    const root: ChartNode = { id: 'app', name: this.appId || 'app', type: 'app', children: [] };
    const clouds: Array<['ocp' | 'gcp', CloudPlatform]> = [['ocp', this.ocp], ['gcp', this.gcp]];

    for (const [cloudKey, block] of clouds) {
      const envChildren: ChartNode[] = [];
      for (const env of ENVS) {
        const platform = (block as any)[`${env}Platform`] as string | undefined;
        const url      = (block as any)[`${env}Url`] as string | undefined;
        const deploys  = this.history[env] ?? [];
        if (!platform && !url && !deploys.length) continue;

        const versionChildren: ChartNode[] = deploys.slice(0, MAX_VERSIONS_PER_ENV).map((d) => ({
          id: `${cloudKey}.${env}.${d.version}.${d.deployedAt}`,
          name: `v${d.version}`,
          type: 'version',
          state: d.state,
          meta: `${d.state} · ${d.deployedBy}`,
        }));

        envChildren.push({
          id: `${cloudKey}.${env}`,
          name: env,
          type: 'env',
          meta: platform || (url ? new URL(url).host : ''),
          children: versionChildren,
        });
      }
      if (envChildren.length === 0) continue;
      const cloudMeta = [block.chart, block.buildChart].filter(Boolean).join(' · ');
      root.children!.push({
        id: cloudKey,
        name: cloudKey.toUpperCase(),
        type: 'cloud',
        meta: cloudMeta,
        children: envChildren,
      });
    }
    return root;
  }

  /* istanbul ignore next */
  private render() {
    if (!this.hasData || !this.containerRef?.nativeElement) return;
    const container = this.containerRef.nativeElement;
    d3.select(container).selectAll('*').remove();

    const margin = { top: 20, right: 200, bottom: 20, left: 80 };
    const width  = container.clientWidth || 900;
    const treeData = this.buildTree();
    const root = d3.hierarchy<ChartNode>(treeData);
    const depth = (root.height + 1);
    const leafCount = root.leaves().length || 1;
    const height = Math.max(220, leafCount * 28 + margin.top + margin.bottom);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.4, 2]).on('zoom', (event) => {
        g.attr('transform', event.transform);
      }))
      .append('g') as d3.Selection<SVGGElement, unknown, null, undefined>;

    const g = svg;
    g.attr('transform', `translate(${margin.left},${margin.top})`);

    const treeLayout = d3.tree<ChartNode>()
      .size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    treeLayout(root);

    g.selectAll<SVGPathElement, d3.HierarchyLink<ChartNode>>('path.link')
      .data(root.links(), (d) => (d.target as d3.HierarchyNode<ChartNode>).data.id)
      .join('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal<d3.HierarchyLink<ChartNode>, d3.HierarchyNode<ChartNode>>()
        .x((n) => n.y ?? 0)
        .y((n) => n.x ?? 0));

    const node = g.selectAll<SVGGElement, d3.HierarchyNode<ChartNode>>('g.node')
      .data(root.descendants(), (d) => d.data.id)
      .join('g')
      .attr('class', (d) => `node ${d.data.type}${d.data.state ? ' ' + d.data.state : ''}`)
      .attr('transform', (d) => `translate(${d.y ?? 0},${d.x ?? 0})`);

    node.append('circle').attr('r', (d) => d.data.type === 'app' ? 8 : d.data.type === 'cloud' ? 7 : 6);

    node.append('text')
      .attr('dy', '0.32em')
      .attr('x', (d) => (d.children ? -10 : 12))
      .attr('text-anchor', (d) => (d.children ? 'end' : 'start'))
      .text((d) => d.data.name);

    node.filter((d) => !!d.data.meta)
      .append('text')
      .attr('class', 'meta')
      .attr('dy', '1.5em')
      .attr('x', (d) => (d.children ? -10 : 12))
      .attr('text-anchor', (d) => (d.children ? 'end' : 'start'))
      .text((d) => d.data.meta!);
  }
}
