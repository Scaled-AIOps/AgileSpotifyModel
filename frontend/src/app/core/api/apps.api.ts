/**
 * Purpose: Typed HTTP client for the /apps endpoints.
 * Usage:   Injected by app-list, app-detail, app-form, dashboard. Wraps ApiService with App-shaped return types.
 * Goal:    Single seam for the application registry from the frontend perspective.
 * ToDo:    —
 */
import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import type { App, AppWithDeploys, AppDeployment, InfraCluster, Certificate, CertificateValidation, AuditEntry } from '../models/index';

@Injectable({ providedIn: 'root' })
export class AppsApi {
  private api = inject(ApiService);

  getAll()                                       { return this.api.get<App[]>('/apps'); }
  getById(appId: string)                         { return this.api.get<AppWithDeploys>(`/apps/${appId}`); }
  getBySquad(squadId: string)                    { return this.api.get<App[]>(`/squads/${squadId}/apps`); }
  getDeployHistory(appId: string, env: string)   { return this.api.get<AppDeployment[]>(`/apps/${appId}/${env}/deploys`); }
  createApp(data: Record<string, unknown>)       { return this.api.post<App>('/apps', data); }
  updateApp(appId: string, data: Record<string, unknown>) { return this.api.patch<App>(`/apps/${appId}`, data); }
  getAuditLog(appId: string)                     { return this.api.get<AuditEntry[]>(`/apps/${appId}/audit`); }

  getAllClusters()                                { return this.api.get<InfraCluster[]>('/infra'); }
  getCluster(platformId: string)                 { return this.api.get<InfraCluster>(`/infra/${platformId}`); }

  getAllCertificates()                            { return this.api.get<Certificate[]>('/certificates'); }
  getCertificate(certId: string)                  { return this.api.get<Certificate>(`/certificates/${certId}`); }
  validateCertificate(certId: string, body: { host?: string; port?: number; timeoutMs?: number } = {}) {
    return this.api.post<CertificateValidation>(`/certificates/${certId}/validate`, body);
  }
  getLastValidation(certId: string) {
    return this.api.get<CertificateValidation>(`/certificates/${certId}/validation`);
  }
}
