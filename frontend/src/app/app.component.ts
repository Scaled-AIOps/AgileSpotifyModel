/**
 * Purpose: Root Angular component.
 * Usage:   Bootstrapped from main.ts via `bootstrapApplication(AppComponent, appConfig)`. Hosts the `<router-outlet>`.
 * Goal:    Minimal shell that lets the router decide what to render.
 * ToDo:    —
 */
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
