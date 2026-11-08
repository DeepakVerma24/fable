import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { Pool, type PoolClient } from 'pg';
import {
  OriginalError,
  OriginalRules,
  type OriginalRound,
  type OriginalAction,
  type StartOriginal,
} from '@fable/domain';

type Command = StartOriginal | OriginalAction;
type Operation = 'start' | 'reveal' | 'finish';
type Apply = (tx: PoolClient, now: string) => Promise<OriginalRound>;

function unavailable() {
  return new OriginalError(
    'unavailable',
    'Saved practice rounds are temporarily unavailable. Retry when casino storage is available.',
  );
}
function sqlCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}
function storageError(error: unknown) {
  const code = sqlCode(error);
  if (
    code.startsWith('08') ||
    [
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      '42P01',
      '42703',
      '53300',
      '57P01',
      '57P02',
      '57P03',
      '57014',
      '55P03',
      '40001',
      '40P01',
    ].includes(code)
  )
    return unavailable();
  return error;
}
async function namespace(connection: Pool | PoolClient): Promise<string> {
  const result = await connection.query<{ id: string }>(
    'SELECT id FROM casino_demo_namespace WHERE singleton',
  );
  if (!result.rows[0]) throw unavailable();
  return result.rows[0].id;
}

/** Every database writer uses one transaction lock per casino player. No wallet locks are acquired. */
export class PostgresOriginalSessions {
  private readonly pool?: Pool;
  constructor(
    url: string | undefined,
    private readonly rules = new OriginalRules(randomInt, randomUUID),
  ) {
    if (url) {
      this.pool = new Pool({
        connectionString: url,
        max: 10,
        connectionTimeoutMillis: 5000,
        application_name: 'fable-casino',
      });
      this.pool.on('error', (error) =>
        process.emitWarning('Idle casino database connection closed (' + sqlCode(error) + ')'),
      );
    }
  }
  private get db(): Pool {
    if (!this.pool) throw unavailable();
    return this.pool;
  }
  async onModuleDestroy() {
    await this.pool?.end();
  }
  async sessionId() {
    try {
      return await namespace(this.db);
    } catch (error) {
      throw storageError(error);
    }
  }
  async get(playerId: string, id: string): Promise<OriginalRound> {
    try {
      const result = await this.db.query<{ public_result: OriginalRound }>(
        'SELECT public_result FROM casino_demo_rounds WHERE player_id=$1 AND id=$2',
        [playerId, id],
      );
      if (!result.rows[0])
        throw new OriginalError('not_found', 'This round does not exist for your account.');
      return result.rows[0].public_result;
    } catch (error) {
      throw storageError(error);
    }
  }
  async list(playerId: string, gameId?: string): Promise<OriginalRound[]> {
    try {
      const result = await this.db.query<{ public_result: OriginalRound }>(
        `
        SELECT public_result FROM casino_demo_rounds WHERE player_id=$1 AND ($2::text IS NULL OR game_id=$2)
        ORDER BY (status='active') DESC, created_at DESC, id DESC LIMIT 50`,
        [playerId, gameId ?? null],
      );
      return result.rows.map((row) => row.public_result);
    } catch (error) {
      throw storageError(error);
    }
  }
  start(playerId: string, input: StartOriginal): Promise<OriginalRound> {
    const { chance, mines, target } = input.options;
    const fingerprint = JSON.stringify(['start', input.gameId, { chance, mines, target }]);
    return this.execute(playerId, input, 'start', fingerprint, async (tx, now) => {
      if (input.gameId === 'fable-mines') {
        const active = await tx.query(
          "SELECT 1 FROM casino_demo_rounds WHERE player_id=$1 AND game_kind='mines' AND status='active'",
          [playerId],
        );
        if (active.rowCount)
          throw new OriginalError(
            'conflict',
            'Finish the existing Mines round before starting another.',
          );
      }
      const state = this.rules.create(input, now);
      const round = state.public;
      await tx.query(
        `INSERT INTO casino_demo_rounds
        (id,player_id,namespace_id,start_key,game_id,game_kind,schema_version,status,revision,inputs,public_result,private_mines,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,1,$7,0,$8,$9,$10,$11,$11)`,
        [
          round.id,
          playerId,
          input.sessionId,
          input.idempotencyKey,
          round.gameId,
          round.kind,
          round.status,
          JSON.stringify(input.options),
          JSON.stringify(round),
          JSON.stringify(state.mines),
          now,
        ],
      );
      return round;
    });
  }
  act(playerId: string, id: string, input: OriginalAction): Promise<OriginalRound> {
    const fingerprint = JSON.stringify([
      'action',
      id,
      input.expectedVersion,
      input.type,
      input.cell ?? null,
    ]);
    return this.execute(playerId, input, input.type, fingerprint, async (tx, now) => {
      const result = await tx.query<{
        schema_version: number;
        public_result: OriginalRound;
        private_mines: number[];
      }>(
        'SELECT schema_version,public_result,private_mines FROM casino_demo_rounds WHERE player_id=$1 AND id=$2 FOR UPDATE',
        [playerId, id],
      );
      const row = result.rows[0];
      if (!row) throw new OriginalError('not_found', 'This round does not exist for your account.');
      if (row.schema_version !== 1) throw unavailable();
      const next = this.rules.advance(
        { public: row.public_result, mines: row.private_mines },
        input,
        now,
      ).public;
      const update = await tx.query(
        `UPDATE casino_demo_rounds SET status=$1, revision=$2, public_result=$3, updated_at=$4
        WHERE player_id=$5 AND id=$6 AND revision=$7 AND status='active'`,
        [next.status, next.version, JSON.stringify(next), now, playerId, id, input.expectedVersion],
      );
      if (update.rowCount !== 1)
        throw new OriginalError('conflict', 'The round changed. Refresh before acting again.');
      return next;
    });
  }
  private async execute(
    playerId: string,
    command: Command,
    operation: Operation,
    fingerprint: string,
    apply: Apply,
  ): Promise<OriginalRound> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transaction(playerId, command, operation, fingerprint, apply);
      } catch (error) {
        if (attempt >= 3 || !['40P01', '40001', '55P03'].includes(sqlCode(error)))
          throw storageError(error);
        await wait(20 * attempt + randomInt(20));
      }
    }
  }
  private async transaction(
    playerId: string,
    command: Command,
    operation: Operation,
    fingerprint: string,
    apply: Apply,
  ): Promise<OriginalRound> {
    const tx = await this.db.connect();
    let discard = false;
    try {
      await tx.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await tx.query("SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='8s'");
      // READ COMMITTED takes a fresh snapshot for the replay lookup after this lock is acquired.
      await tx.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('fable:casino:' || $1::text,0))",
        [playerId],
      );
      if (command.sessionId !== (await namespace(tx)))
        throw new OriginalError(
          'session_changed',
          'This saved request belongs to a different casino database. Refresh to start a new request.',
        );
      const replay = await tx.query<{ fingerprint: string; response: OriginalRound }>(
        'SELECT fingerprint,response FROM casino_demo_commands WHERE player_id=$1 AND request_key=$2',
        [playerId, command.idempotencyKey],
      );
      const old = replay.rows[0];
      if (old && old.fingerprint !== fingerprint)
        throw new OriginalError(
          'conflict',
          'This action key was already used with different settings.',
        );
      let response = old?.response;
      if (!response) {
        const clock = await tx.query<{ at: Date }>('SELECT clock_timestamp() AS at');
        response = await apply(tx, clock.rows[0]!.at.toISOString());
        await tx.query(
          `INSERT INTO casino_demo_commands(player_id,request_key,round_id,operation,fingerprint,revision,response)
          VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [
            playerId,
            command.idempotencyKey,
            response.id,
            operation,
            fingerprint,
            response.version,
            JSON.stringify(response),
          ],
        );
      }
      await tx.query('COMMIT');
      return response;
    } catch (error) {
      try {
        await tx.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      tx.release(discard);
    }
  }
}
