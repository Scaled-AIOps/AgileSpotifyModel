/**
 * Purpose: OAuth callback screen.
 * Usage:   Routed at /auth/callback by the backend after Jira / Microsoft redirect.
 * Goal:    Bridge from the SSO flow into the SPA — exchanges the URL token for the in-memory access token and navigates to /apps.
 * ToDo:    —
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  template: `
    <div style="min-height:100vh;display:grid;place-items:center">
      @if (error) {
        <div style="text-align:center;max-width:420px;padding:2rem">
          <div style="font-size:2rem;margin-bottom:1rem">⚠</div>
          <h2 style="margin:0 0 0.5rem">Sign-in failed</h2>
          <p style="color:var(--text-muted);margin:0 0 1.5rem">{{ error }}</p>
          <a href="/auth/login" class="btn btn-primary">Back to login</a>
        </div>
      } @else {
        <span class="spinner spinner-lg"></span>
      }
    </div>
  `,
})
export class OAuthCallbackComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private auth   = inject(AuthService);
  private router = inject(Router);

  error = '';

  async ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    const err   = this.route.snapshot.queryParamMap.get('error');

    if (err) {
      this.error = decodeURIComponent(err);
      return;
    }

    if (!token) {
      this.error = 'No token received from identity provider.';
      return;
    }

    this.auth.setAccessToken(token);
    try {
      await this.auth.loadCurrentUser();
      this.router.navigate(['/apps']);
    } catch {
      this.error = 'Could not load your profile. Contact an admin.';
    }
  }
}
