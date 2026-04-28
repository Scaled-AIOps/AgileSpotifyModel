/**
 * Purpose: Member create / edit form.
 * Usage:   Routed at /admin/members/new and /admin/members/:id.
 * Goal:    Single screen for adding or amending a person record.
 * ToDo:    —
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MemberApi } from '../../../core/api/member.api';
import { SquadApi } from '../../../core/api/squad.api';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import type { Member, Squad } from '../../../core/models/index';

@Component({
  selector: 'app-member-form',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (loadError) {
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">{{ loadError }}</div>
        <div class="empty-sub"><a routerLink="/admin/members">← Back to Members</a></div>
      </div>
    }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ isEdit ? (isFullAdmin ? 'Edit Member' : 'Member Details') : 'New Member' }}</h1>
        </div>
        <a class="btn btn-ghost" routerLink="/admin/members">← Back</a>
      </div>

      <div class="card" style="max-width:520px">
        <div class="card-body">
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="form-field">
              <label>Name</label>
              <input class="value-input" formControlName="name" placeholder="Full name" autocomplete="off" />
            </div>
            <div class="form-field">
              <label>Email</label>
              <input class="value-input" type="email" formControlName="email" placeholder="user@example.com" autocomplete="off" />
            </div>
            @if (!isEdit) {
              <div class="form-field">
                <label>Password</label>
                <input class="value-input" type="password" formControlName="password" placeholder="Min 8 characters" autocomplete="new-password" />
              </div>
            }
            <div class="form-field">
              <label>Role</label>
              <select class="value-input" formControlName="role">
                <option value="Admin">Admin</option>
                <option value="TribeLead">Tribe Lead</option>
                <option value="PO">Product Owner</option>
                <option value="AgileCoach">Agile Coach</option>
                <option value="ReleaseManager">Release Manager</option>
                <option value="Member">Member</option>
              </select>
            </div>
            <div class="form-field">
              <label>Squad</label>
              <select class="value-input" formControlName="squadId">
                <option value="">— None —</option>
                @for (s of squads; track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </div>

            @if (error) {
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-sm);padding:10px 14px;color:var(--danger);font-size:0.875rem;margin-top:4px">
                {{ error }}
              </div>
            }
          </form>
        </div>
        <div class="card-footer-row" style="justify-content:flex-end;gap:8px">
          <a class="btn btn-ghost" routerLink="/admin/members">Cancel</a>
          @if (!isEdit || isFullAdmin) {
            <button class="btn btn-primary" (click)="submit()" [disabled]="form.invalid || saving">
              @if (saving) { <span class="spinner"></span> }
              {{ isEdit ? 'Update' : 'Create' }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class MemberFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private memberApi = inject(MemberApi);
  private squadApi = inject(SquadApi);
  private api = inject(ApiService);
  private auth = inject(AuthService);

  isEdit = false;
  memberId = '';
  squads: Squad[] = [];
  loading = true;
  saving = false;
  error = '';
  loadError = '';

  get isFullAdmin() { const r = this.auth.currentUser()?.role; return r === 'Admin' || r === 'AgileCoach'; }

  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    role: ['Member', Validators.required],
    squadId: [''],
  });

  async ngOnInit() {
    this.memberId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isEdit = !!this.memberId;

    if (!this.isEdit) {
      this.form.get('password')!.setValidators([Validators.required, Validators.minLength(8)]);
    }

    this.squads = await firstValueFrom(this.squadApi.getAll());

    if (this.isEdit) {
      try {
        const member = await firstValueFrom(this.memberApi.getById(this.memberId));
        this.form.patchValue({ name: member.name, email: member.email, role: member.role, squadId: member.squadId });
        if (!this.isFullAdmin) {
          this.form.disable();
        }
      } catch {
        this.loadError = `Member "${this.memberId}" not found.`;
      }
    }

    this.loading = false;
  }

  async submit() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = '';
    try {
      if (this.isEdit) {
        const { password, ...updateData } = this.form.value;
        await firstValueFrom(this.memberApi.update(this.memberId, updateData as Partial<Member>));
      } else {
        await firstValueFrom(this.memberApi.create(this.form.value as Member & { password: string }));
      }
      this.router.navigate(['/admin/members']);
    } catch (err: unknown) {
      this.error = (err as { error?: { error?: string } })?.error?.error ?? 'An error occurred';
    } finally {
      this.saving = false;
    }
  }
}
