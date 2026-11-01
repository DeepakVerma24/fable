/**
 * Audit metadata is restricted to scalars so callers cannot drop raw objects,
 * tokens, or payment instruments into the log.
 */
export type AuditScalar = string | number | boolean | null;

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  metadata: Readonly<Record<string, AuditScalar>>;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export class InMemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push({
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
      metadata: { ...event.metadata },
    });
  }
}
