BEGIN;
SET LOCAL lock_timeout = '5s';

-- An immutable database identity preserves saved client commands across API restarts.
CREATE TABLE casino_demo_namespace (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid()
);
INSERT INTO casino_demo_namespace(singleton) VALUES (true);

CREATE TABLE casino_demo_rounds (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  namespace_id uuid NOT NULL REFERENCES casino_demo_namespace(id),
  start_key varchar(80) NOT NULL CHECK (start_key ~ '^[a-zA-Z0-9._:-]{8,80}$'),
  game_id text NOT NULL,
  game_kind text NOT NULL,
  schema_version smallint NOT NULL CHECK (schema_version = 1),
  status text NOT NULL CHECK (status IN ('active','complete')),
  revision integer NOT NULL CHECK (revision BETWEEN 0 AND 26),
  inputs jsonb NOT NULL CHECK (jsonb_typeof(inputs) = 'object'),
  public_result jsonb NOT NULL,
  private_mines jsonb NOT NULL CHECK (jsonb_typeof(private_mines) = 'array'),
  created_at timestamptz(3) NOT NULL,
  updated_at timestamptz(3) NOT NULL CHECK (updated_at >= created_at),
  UNIQUE (player_id,id),
  UNIQUE (player_id,start_key),
  CHECK ((game_id,game_kind) IN (('paper-dice','dice'),('fable-mines','mines'),('fable-plinko','plinko'),('fable-limbo','limbo'))),
  CHECK (public_result @> jsonb_build_object('id',id,'sessionId',namespace_id,'gameId',game_id,'kind',game_kind,
    'version',revision,'status',status,'stateSchemaVersion',schema_version,'simulated',true,'financial',false,'realMoney',false,'referencePoints',100)),
  CHECK (game_kind = 'mines' OR (status = 'complete' AND revision = 0 AND private_mines = '[]')),
  CHECK (status <> 'active' OR (public_result @> '{"outcome":"in-progress"}' AND NOT (public_result->'mines' ? 'locations'))),
  CHECK (game_kind <> 'mines' OR ((jsonb_typeof(public_result->'mines'->'revealed') = 'array'
    AND jsonb_array_length(private_mines) BETWEEN 1 AND 10
    AND public_result->'mines'->'mineCount' = to_jsonb(jsonb_array_length(private_mines))
    AND (status = 'active' OR public_result->'mines'->'locations' = private_mines)) IS TRUE))
);
CREATE UNIQUE INDEX casino_demo_single_active_mines ON casino_demo_rounds(player_id) WHERE status='active' AND game_kind='mines';
CREATE INDEX casino_demo_player_history ON casino_demo_rounds(player_id,game_id,created_at DESC,id DESC);

CREATE TABLE casino_demo_commands (
  player_id uuid NOT NULL,
  request_key varchar(80) NOT NULL CHECK (request_key ~ '^[a-zA-Z0-9._:-]{8,80}$'),
  round_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('start','reveal','finish')),
  fingerprint text NOT NULL,
  revision integer NOT NULL CHECK (revision BETWEEN 0 AND 26),
  response jsonb NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (player_id,request_key),
  UNIQUE(round_id,revision),
  FOREIGN KEY(player_id,round_id) REFERENCES casino_demo_rounds(player_id,id),
  CHECK ((operation='start') = (revision=0)),
  CHECK (response @> jsonb_build_object('id',round_id,'version',revision,'simulated',true,'financial',false,'realMoney',false))
);

CREATE FUNCTION casino_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Casino history is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER casino_namespace_immutable BEFORE UPDATE OR DELETE ON casino_demo_namespace FOR EACH ROW EXECUTE FUNCTION casino_reject_change();
CREATE TRIGGER casino_round_no_delete BEFORE DELETE ON casino_demo_rounds FOR EACH ROW EXECUTE FUNCTION casino_reject_change();
CREATE TRIGGER casino_command_immutable BEFORE UPDATE OR DELETE ON casino_demo_commands FOR EACH ROW EXECUTE FUNCTION casino_reject_change();

CREATE FUNCTION casino_check_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_cells jsonb; new_cells jsonb; old_count int; new_count int;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.revision <> 0 OR (NEW.game_kind='mines' AND (NEW.status <> 'active' OR NEW.public_result->'mines'->'revealed' <> '[]')) THEN
      RAISE EXCEPTION 'Invalid initial casino round' USING ERRCODE='23514';
    END IF;
    IF NEW.game_kind='mines' AND jsonb_array_length(NEW.private_mines) <> (
      SELECT count(*) FROM generate_series(0,24) AS cells(n) WHERE NEW.private_mines @> jsonb_build_array(n)
    ) THEN
      RAISE EXCEPTION 'Invalid private Mines board' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status <> 'active' OR NEW.revision <> OLD.revision+1 OR NEW.updated_at < OLD.updated_at OR
    (NEW.id,NEW.player_id,NEW.namespace_id,NEW.start_key,NEW.game_id,NEW.game_kind,NEW.schema_version,NEW.inputs,NEW.private_mines,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.player_id,OLD.namespace_id,OLD.start_key,OLD.game_id,OLD.game_kind,OLD.schema_version,OLD.inputs,OLD.private_mines,OLD.created_at) THEN
    RAISE EXCEPTION 'Invalid casino round transition' USING ERRCODE='23514';
  END IF;
  old_cells := OLD.public_result->'mines'->'revealed';
  new_cells := NEW.public_result->'mines'->'revealed';
  old_count := jsonb_array_length(old_cells); new_count := jsonb_array_length(new_cells);
  IF new_count=old_count THEN
    IF old_count=0 OR new_cells <> old_cells OR NEW.status <> 'complete' OR NEW.public_result->>'outcome' IS DISTINCT FROM 'finished' THEN
      RAISE EXCEPTION 'Invalid Mines finish' USING ERRCODE='23514';
    END IF;
  ELSIF new_count <> old_count+1 OR new_cells-old_count <> old_cells OR old_cells @> jsonb_build_array(new_cells->old_count)
      OR NOT EXISTS (SELECT 1 FROM generate_series(0,24) AS cells(n) WHERE to_jsonb(n)=new_cells->old_count) THEN
    RAISE EXCEPTION 'Invalid Mines reveal' USING ERRCODE='23514';
  ELSIF OLD.private_mines @> jsonb_build_array(new_cells->old_count) THEN
    IF NEW.status <> 'complete' OR NEW.public_result->>'outcome' IS DISTINCT FROM 'mine' THEN
      RAISE EXCEPTION 'A mine ends the round' USING ERRCODE='23514';
    END IF;
  ELSIF new_count = 25-jsonb_array_length(OLD.private_mines) THEN
    IF NEW.status <> 'complete' OR NEW.public_result->>'outcome' IS DISTINCT FROM 'finished' THEN
      RAISE EXCEPTION 'The final safe cell ends the round' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.status <> 'active' THEN
    RAISE EXCEPTION 'A safe reveal leaves the round active' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER casino_round_transition BEFORE INSERT OR UPDATE ON casino_demo_rounds FOR EACH ROW EXECUTE FUNCTION casino_check_transition();

-- A changed revision and its exact replay response must commit together.
CREATE FUNCTION casino_require_command() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_operation text;
BEGIN
  IF TG_OP='INSERT' THEN expected_operation := 'start';
  ELSIF NEW.public_result->'mines'->'revealed' = OLD.public_result->'mines'->'revealed' THEN expected_operation := 'finish';
  ELSE expected_operation := 'reveal';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM casino_demo_commands c WHERE c.player_id=NEW.player_id AND c.round_id=NEW.id
    AND c.revision=NEW.revision AND c.response=NEW.public_result AND c.operation=expected_operation
    AND (NEW.revision<>0 OR c.request_key=NEW.start_key)) THEN
    RAISE EXCEPTION 'Casino round revision requires its matching replay record' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER casino_revision_command AFTER INSERT OR UPDATE ON casino_demo_rounds
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION casino_require_command();
CREATE FUNCTION casino_require_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM casino_demo_rounds r WHERE r.id=NEW.round_id AND r.player_id=NEW.player_id
    AND r.revision=NEW.revision AND r.public_result=NEW.response) THEN
    RAISE EXCEPTION 'Casino replay record requires its matching round revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER casino_command_matches_round BEFORE INSERT ON casino_demo_commands FOR EACH ROW EXECUTE FUNCTION casino_require_revision();
COMMIT;
