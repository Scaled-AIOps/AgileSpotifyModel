/**
 * Purpose: D3 collapsible org tree visualisation.
 * Usage:   Routed at /org/tree. Fetches the full /org/tree response and renders an SVG hierarchy with click-to-collapse + click-to-navigate.
 * Goal:    Single picture of the entire organisation, useful for orientation and onboarding.
 * ToDo:    Persist collapse state across navigations; add a search-to-highlight input.
 */
import { Component, OnDestroy, ElementRef, ViewChild, inject, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import * as d3 from 'd3';
import { OrgApi } from '../../../core/api/org.api';
import { TranslateModule } from '@ngx-translate/core';
import type { OrgTreeDomain } from '../../../core/models/index';
import { firstValueFrom } from 'rxjs';

interface TreeNode {
  id: string;
  name: string;
  type: string;
  route?: string;
  children?: TreeNode[];
  _collapsed?: boolean;
}

@Component({
  selector: 'app-org-tree',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="org-tree-page">
      <div class="legend">
        <span class="legend-item"><span class="dot dot-domain"></span>{{ 'common.domain' | translate }}</span>
        <span class="legend-item"><span class="dot dot-subdomain"></span>{{ 'common.subdomain' | translate }}</span>
        <span class="legend-item"><span class="dot dot-tribe"></span>{{ 'common.tribe' | translate }}</span>
        <span class="legend-item"><span class="dot dot-squad"></span>{{ 'common.squad' | translate }}</span>
      </div>
      @if (loading) {
        <div class="loading-block"><span class="spinner spinner-lg"></span></div>
      } @else {
        <div #treeContainer class="tree-container"></div>
      }
    </div>
  `,
  styles: [`
    .org-tree-page { padding: 8px; }
    .legend { display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
    .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .dot-domain   { background: #3f51b5; border: 2px solid #1a237e; }
    .dot-subdomain { background: #7986cb; border: 2px solid #3f51b5; }
    .dot-tribe    { background: #26a69a; border: 2px solid #00695c; }
    .dot-squad    { background: #66bb6a; border: 2px solid #2e7d32; }
    .tree-container { width: 100%; overflow: auto; }
    :host ::ng-deep .node circle { cursor: pointer; stroke-width: 2; }
    :host ::ng-deep .node text { font-size: 12px; font-family: sans-serif; }
    :host ::ng-deep .link { fill: none; stroke: #ccc; stroke-width: 1.5px; }
    :host ::ng-deep .node.domain circle { fill: #3f51b5; stroke: #1a237e; }
    :host ::ng-deep .node.subdomain circle { fill: #7986cb; stroke: #3f51b5; }
    :host ::ng-deep .node.tribe circle { fill: #26a69a; stroke: #00695c; }
    :host ::ng-deep .node.squad circle { fill: #66bb6a; stroke: #2e7d32; }
    :host ::ng-deep .node circle { fill: #fff; stroke: #ccc; }
  `],
})
export class OrgTreeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('treeContainer') private containerRef!: ElementRef<HTMLDivElement>;

  private orgApi = inject(OrgApi);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = true;

  async ngAfterViewInit() {
    const domains = await firstValueFrom(this.orgApi.getTree());
    this.loading = false;
    // Force CD so `@if (loading)` swaps in the #treeContainer div before we touch ViewChild.
    this.cdr.detectChanges();
    if (this.containerRef?.nativeElement) {
      this.renderTree(domains);
    }
  }

  ngOnDestroy() {
    if (this.containerRef?.nativeElement) {
      d3.select(this.containerRef.nativeElement).selectAll('*').remove();
    }
  }

  private buildTreeData(domains: OrgTreeDomain[]): TreeNode {
    const root: TreeNode = { id: 'root', name: 'Organisation', type: 'root', children: [] };

    for (const domain of domains) {
      const domainNode: TreeNode = { id: domain.id, name: domain.name, type: 'domain', route: `/org/domains/${domain.id}`, children: [] };

      for (const sd of domain.subdomains ?? []) {
        const sdNode: TreeNode = { id: sd.id, name: sd.name, type: 'subdomain', children: [] };
        for (const tribe of sd.tribes ?? []) {
          const tribeNode: TreeNode = { id: tribe.id, name: tribe.name, type: 'tribe', route: `/org/tribes/${tribe.id}`, children: [] };
          for (const squad of tribe.squads ?? []) {
            const appSuffix = squad.appCount ? ` · ${squad.appCount} apps` : '';
          tribeNode.children!.push({ id: squad.id, name: `${squad.name} (${squad.memberCount}${appSuffix})`, type: 'squad', route: `/org/squads/${squad.id}` });
          }
          sdNode.children!.push(tribeNode);
        }
        domainNode.children!.push(sdNode);
      }

      for (const tribe of domain.tribes ?? []) {
        const tribeNode: TreeNode = { id: tribe.id, name: tribe.name, type: 'tribe', route: `/org/tribes/${tribe.id}`, children: [] };
        for (const squad of tribe.squads ?? []) {
          const appSuffix = squad.appCount ? ` · ${squad.appCount} apps` : '';
          tribeNode.children!.push({ id: squad.id, name: `${squad.name} (${squad.memberCount}${appSuffix})`, type: 'squad', route: `/org/squads/${squad.id}` });
        }
        domainNode.children!.push(tribeNode);
      }

      root.children!.push(domainNode);
    }

    return root;
  }

  /* istanbul ignore next */
  private renderTree(domains: OrgTreeDomain[]) {
    const container = this.containerRef.nativeElement;
    const width = container.clientWidth || 900;
    const margin = { top: 20, right: 180, bottom: 20, left: 80 };
    const height = 600;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .call(d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 2]).on('zoom', (event) => {
        g.attr('transform', event.transform);
      }))
      .append('g') as d3.Selection<SVGGElement, unknown, null, undefined>;

    const g = svg;
    g.attr('transform', `translate(${margin.left},${margin.top})`);

    const treeData = this.buildTreeData(domains);
    const router = this.router;

    const treeLayout = d3.tree<TreeNode>().size([height - margin.top - margin.bottom, width - margin.left - margin.right]);
    const root = d3.hierarchy<TreeNode>(treeData);

    function update(_source: d3.HierarchyNode<TreeNode>) {
      treeLayout(root);

      // Hide the synthetic 'root' node — the chart starts at the
      // tribeDomain level. d3's tree layout still needs a single root
      // for spacing, so we keep it but filter it (and the four invisible
      // root→domain links) out of rendering.
      const nodes = root.descendants().filter((n) => n.data.type !== 'root');

      // Pull the chart left so the visible leftmost column (the
      // tribeDomains) sits at the page's left edge instead of leaving
      // an empty 'root' column behind.
      const minY = Math.min(...nodes.map((n) => n.y ?? 0));
      nodes.forEach((n) => { n.y = (n.y ?? 0) - minY; });
      const links = root.links().filter((l) =>
        (l.source as d3.HierarchyNode<TreeNode>).data.type !== 'root');

      g.selectAll<SVGPathElement, d3.HierarchyLink<TreeNode>>('path.link')
        .data(links, (d) => (d.target as d3.HierarchyNode<TreeNode>).data.id)
        .join('path')
        .attr('class', 'link')
        .attr('d', d3.linkHorizontal<d3.HierarchyLink<TreeNode>, d3.HierarchyNode<TreeNode>>()
          .x((n) => n.y ?? 0)
          .y((n) => n.x ?? 0));

      const node = g.selectAll<SVGGElement, d3.HierarchyNode<TreeNode>>('g.node')
        .data(nodes, (d) => d.data.id)
        .join('g')
        .attr('class', (d) => `node ${d.data.type}`)
        .attr('transform', (d) => `translate(${d.y},${d.x})`)
        .on('click', (_event, d) => {
          if (d.data.route) router.navigate([d.data.route]);
          if (d.children) { (d as d3.HierarchyNode<TreeNode> & { _children?: typeof d.children })._children = d.children; d.children = undefined; }
          else if ((d as d3.HierarchyNode<TreeNode> & { _children?: typeof d.children })._children) {
            d.children = (d as d3.HierarchyNode<TreeNode> & { _children?: typeof d.children })._children;
            (d as d3.HierarchyNode<TreeNode> & { _children?: typeof d.children })._children = undefined;
          }
          update(d);
        });

      node.selectAll<SVGCircleElement, d3.HierarchyNode<TreeNode>>('circle')
        .data((d) => [d])
        .join('circle')
        .attr('r', 8);

      node.selectAll<SVGTextElement, d3.HierarchyNode<TreeNode>>('text')
        .data((d) => [d])
        .join('text')
        .attr('dy', '0.35em')
        .attr('x', (d) => (d.children || (d as d3.HierarchyNode<TreeNode> & { _children?: unknown })._children ? -14 : 14))
        .attr('text-anchor', (d) => (d.children || (d as d3.HierarchyNode<TreeNode> & { _children?: unknown })._children ? 'end' : 'start'))
        .text((d) => d.data.name);
    }

    update(root);
  }
}
